const User = require("../models/User");
const Personnel = require("../models/Personnel");
const { createAuditLog } = require("./auditController");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

// ── Profile Picture / Farm Logo storage ──────────────────────────────────
//
// Uploaded images are stored in MongoDB (User.avatarImage / farmLogoImage)
// and served by GET /api/v1/profile/avatar/:userId and
// GET /api/v1/profile/farm-logo. The database is the only storage that
// survives Render redeploys and is shared by every device; the old
// uploads/ folder on the server's disk was wiped on each redeploy / restart,
// which is why pictures "disappeared".
//
// The reference saved in User.avatar / User.farmLogo is the image URL with a
// version (?v=<upload time>) so browsers and devices always fetch the newest
// image after a change, yet can cache each version.
const API_BASE_PATH = `/api/${process.env.API_VERSION || "v1"}/profile`;
const avatarUrl = (userId, at) => `${API_BASE_PATH}/avatar/${userId}?v=${at.getTime()}`;
const farmLogoUrl = (at) => `${API_BASE_PATH}/farm-logo?v=${at.getTime()}`;

// The file's real type from its first bytes -- the browser-supplied
// mimetype and extension can lie. Returns null for anything that is not a
// JPEG / PNG / GIF / WEBP image.
function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.slice(0, 4).toString("ascii") === "GIF8") return "image/gif";
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

// Validates the uploaded file; returns { image } or { error }.
function readUploadedImage(file) {
  if (!file || !file.buffer || !file.buffer.length) {
    return { error: "No image uploaded." };
  }
  const contentType = detectImageType(file.buffer);
  if (!contentType) {
    return { error: "The file is not a valid JPG, PNG, WEBP or GIF image." };
  }
  return {
    image: {
      data: file.buffer,
      contentType,
      size: file.buffer.length,
      updatedAt: new Date(),
    },
  };
}

// .lean() returns the stored bytes as a BSON Binary, not a Buffer.
function toBuffer(data) {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data;
  if (data.buffer) return Buffer.from(data.buffer);
  return null;
}

function sendStoredImage(res, image) {
  const data = toBuffer(image?.data);
  if (!data || !data.length) {
    return res.status(404).json({ success: false, message: "Image not found." });
  }
  res.set({
    "Content-Type": image.contentType || "application/octet-stream",
    "Content-Length": String(data.length),
    // Each upload gets a new ?v= URL, so a given URL never changes content.
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    // Exports (PDF) may load the logo from another origin.
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  return res.end(data);
}

// GET /profile/avatar/:userId -- public on purpose: <img> tags cannot send
// the login token (the old /uploads files were public too). Only the
// picture is returned, never any other account data.
exports.getAvatarImage = async (req, res) => {
  try {
    if (!/^[0-9a-f]{24}$/i.test(req.params.userId || "")) {
      return res.status(404).json({ success: false, message: "Image not found." });
    }
    const user = await User.findById(req.params.userId).select("+avatarImage").lean();
    return sendStoredImage(res, user?.avatarImage);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Unable to load image." });
  }
};

// GET /profile/farm-logo -- the farm's logo (stored on the Owner record).
exports.getFarmLogoImage = async (req, res) => {
  try {
    const owner = await User.findOne({ role: "Owner", "farmLogoImage.size": { $gt: 0 } })
      .select("+farmLogoImage")
      .sort({ "farmLogoImage.updatedAt": -1 })
      .lean();
    return sendStoredImage(res, owner?.farmLogoImage);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Unable to load image." });
  }
};

// One-time, on startup: moves pictures saved by the old disk-based upload
// into the database. A legacy "/uploads/..." reference whose file still
// exists is imported; one whose file is already gone (wiped by a redeploy)
// can never load again, so it is cleared and the default avatar / logo
// shows until a new one is uploaded. Nothing else on the user is touched.
exports.migrateLegacyImages = async () => {
  const users = await User.find({
    $or: [{ avatar: /^\/uploads\// }, { farmLogo: /^\/uploads\// }],
  }).select("avatar farmLogo");
  let imported = 0;
  let cleared = 0;

  for (const user of users) {
    for (const [refField, imageField, toUrl] of [
      ["avatar", "avatarImage", (at) => avatarUrl(user._id, at)],
      ["farmLogo", "farmLogoImage", (at) => farmLogoUrl(at)],
    ]) {
      const ref = user[refField];
      if (!/^\/uploads\//.test(ref || "")) continue;
      const file = path.join(__dirname, "..", ref.replace(/^\/+/, "").split("?")[0]);
      let buffer = null;
      try { buffer = fs.readFileSync(file); } catch { buffer = null; }
      const contentType = detectImageType(buffer);
      if (contentType) {
        const at = new Date();
        await User.updateOne(
          { _id: user._id },
          { $set: { [refField]: toUrl(at), [imageField]: { data: buffer, contentType, size: buffer.length, updatedAt: at } } }
        );
        imported += 1;
      } else {
        await User.updateOne({ _id: user._id }, { $set: { [refField]: "" } });
        cleared += 1;
      }
    }
  }
  if (imported || cleared) {
    console.log(`Profile images: ${imported} legacy image(s) moved into the database, ${cleared} missing file reference(s) cleared.`);
  }
  return { imported, cleared };
};

async function resolvePersonnelInfo(user) {
  if (user.role === "Owner") {
    return { position: "Owner", employmentStatus: "Active" };
  }
  const personnel = await Personnel.findOne({ user: user._id }).select("position status");
  return {
    position: personnel?.position || "",
    employmentStatus: personnel?.status || "",
  };
}

exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const { position, employmentStatus } = await resolvePersonnelInfo(user);

    return res.json({
      success: true,
      record: {
        fullName: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        avatar: user.avatar || "",
        role: user.role,
        position,
        employmentStatus,
        status: user.status,
        dateJoined: user.createdAt
            ? user.createdAt.toISOString().split("T")[0]
            : "",
        lastLogin: user.lastLogin
            ? new Date(user.lastLogin).toLocaleString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            })
        : "Never",
        language: user.language || "English",
        textSize: user.textSize || "default",
        timezone: user.timezone || "(GMT+08:00) Asia/Manila",
        emailNotif: user.emailNotif ?? true,
        loginAlerts: user.loginAlerts ?? true,
        farmName: user.farmName || "",
        farmLocation: user.farmLocation || "",
        farmContact: user.farmContact || "",
        farmEmail: user.farmEmail || "",
        farmLogo: user.farmLogo || "",
      },
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Failed to load profile.",
    });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {

    const {
      fullName,
      email,
      phone,
      address,
      avatar,
      language,
      timezone,
      emailNotif,
      loginAlerts,
      farmName,
      farmLocation,
      farmContact,
      farmEmail,
    } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    user.name = fullName;
    user.email = email;
    user.phone = phone;
    user.address = address;
    // The picture is changed ONLY by POST /upload-avatar (which stores the
    // image). The form echoes the saved URL back here; anything else -- a
    // missing value, a "blob:" preview URL, another user's picture -- is
    // ignored so it can never overwrite or erase the saved picture.
    void avatar;
    user.language = language;
    user.timezone = timezone;
    user.emailNotif = emailNotif;
    user.loginAlerts = loginAlerts;

    if (farmName !== undefined) user.farmName = farmName;
    if (farmLocation !== undefined) user.farmLocation = farmLocation;
    if (farmContact !== undefined) user.farmContact = farmContact;
    if (farmEmail !== undefined) user.farmEmail = farmEmail;

    await user.save();

    const { position, employmentStatus } = await resolvePersonnelInfo(user);

    await createAuditLog({
    user: user.name,
    role: user.role,
    module: "Profile",
    action: "Edited",
    description: "Updated profile information.",
    });

    return res.json({
      success: true,
      record: {
        fullName: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
        role: user.role,
        position,
        employmentStatus,
        status: user.status,
        dateJoined: user.createdAt,
        lastLogin: user.lastLogin
            ? new Date(user.lastLogin).toLocaleString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            })
        : "Never",
        language: user.language,
        timezone: user.timezone,
        emailNotif: user.emailNotif,
        loginAlerts: user.loginAlerts,
        farmName: user.farmName || "",
        farmLocation: user.farmLocation || "",
        farmContact: user.farmContact || "",
        farmEmail: user.farmEmail || "",
        farmLogo: user.farmLogo || "",
      },
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Profile update failed.",
    });

  }
};

exports.getFarmInfo = async (req, res) => {
  try {
    const owner = await User.findOne({ role: "Owner" });
    // The logo may have been uploaded by any Owner account: use the newest.
    const logoOwner = await User.findOne({ role: "Owner", farmLogo: { $ne: "" } })
      .sort({ "farmLogoImage.updatedAt": -1 })
      .select("farmLogo")
      .lean();

    return res.json({
      farmName: owner?.farmName || "",
      farmLocation: owner?.farmLocation || "",
      farmContact: owner?.farmContact || "",
      farmEmail: owner?.farmEmail || "",
      farmLogo: logoOwner?.farmLogo || owner?.farmLogo || "",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Failed to load farm information.",
    });
  }
};

exports.uploadFarmLogo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Validated BEFORE anything is saved: a failed upload never replaces
    // the current logo.
    const { image, error } = readUploadedImage(req.file);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    // Bytes and URL are written together in one update, so the record never
    // points at an image that was not stored. The previous logo's bytes are
    // replaced in place (no orphaned copies).
    const farmLogo = farmLogoUrl(image.updatedAt);
    await User.updateOne({ _id: user._id }, { $set: { farmLogo, farmLogoImage: image } });

    await createAuditLog({
    user: user.name,
    role: user.role,
    module: "Profile",
    action: "Edited",
    description: "Updated farm logo.",
    });

    res.json({
      success: true,
      message: "Farm logo updated successfully.",
      farmLogo,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to upload farm logo.",
    });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    // Always the signed-in user's own record: nobody can change another
    // user's picture through this endpoint.
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Validated BEFORE anything is saved: a failed upload never replaces
    // the current picture.
    const { image, error } = readUploadedImage(req.file);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    // Bytes and URL are written together in one update; the old picture's
    // bytes are replaced in place (no orphaned files).
    const avatar = avatarUrl(user._id, image.updatedAt);
    await User.updateOne({ _id: user._id }, { $set: { avatar, avatarImage: image } });

    await createAuditLog({
    user: user.name,
    role: user.role,
    module: "Profile",
    action: "Edited",
    description: "Updated profile picture.",
    });

    res.json({
      success: true,
      message: "Profile picture updated successfully.",
      avatar,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to upload profile picture.",
    });
  }
};

// PUT /profile/text-size -- the signed-in user's own Text Size preference.
// Saved on its own (no other profile field is touched), the moment the user
// picks a size in My Profile.
const TEXT_SIZES = ["small", "default", "large", "xlarge"];
exports.updateTextSize = async (req, res) => {
  try {
    const { textSize } = req.body || {};
    if (!TEXT_SIZES.includes(textSize)) {
      return res.status(400).json({ success: false, message: "Invalid text size." });
    }
    const result = await User.updateOne({ _id: req.user.id }, { $set: { textSize } });
    if (!result.matchedCount) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.json({ success: true, textSize });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Unable to save text size." });
  }
};

exports.changePassword = async (req, res) => {

  try {

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);

    const match = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();

    await createAuditLog({
    user: user.name,
    role: user.role,
    module: "Profile",
    action: "Edited",
    description: "Changed account password.",
    });

    res.json({
      success: true,
      message: "Password updated successfully.",
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to update password.",
    });

  }
};