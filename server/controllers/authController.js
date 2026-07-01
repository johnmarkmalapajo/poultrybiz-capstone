const User = require('../models/User')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const nodemailer = require('nodemailer')

// ── Signup ──
exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    const existing = await User.findOne({ email })
    if (existing) return res.json({ success: false, message: 'Email already registered.' })

    const hashed = await bcrypt.hash(password, 10)
    const user   = await User.create({ name, email, password: hashed, role })
    const token  = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } })
  } catch (err) {
    res.json({ success: false, message: 'Signup failed.' })
  }
}

// ── Login ──
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.json({ success: false, message: 'No account found with that email.' })

    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.json({ success: false, message: 'Incorrect password.' })

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } })
  } catch (err) {
    res.json({ success: false, message: 'Login failed.' })
  }
}

// ── Forgot Password ──
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    console.log('Forgot password request for:', email)
    
    const user = await User.findOne({ email })
    console.log('User found:', user ? 'YES' : 'NO')
    
    if (!user) return res.json({ success: false, message: 'No account found with that email.' })

    const token = require('crypto').randomBytes(32).toString('hex')
    user.resetToken       = token
    user.resetTokenExpiry = Date.now() + 1000 * 60 * 60
    await user.save()
    console.log('Token saved')

    const transporter = require('nodemailer').createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    })

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`
    console.log('Reset link:', resetLink)

    await transporter.sendMail({
      from: `"PoultyBiz" <${process.env.MAIL_USER}>`,
      to: user.email,
      subject: 'Reset Your Password — PoultyBiz',
      html: `<a href="${resetLink}">Reset Password</a>`,
    })
    console.log('Email sent!')

    res.json({ success: true, message: 'Reset link sent to your email.' })
  } catch (err) {
    console.error('Forgot password error:', err.message)
    res.json({ success: false, message: 'Something went wrong.' })
  }
}

// ── Reset Password ──
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body
    const user = await User.findOne({
      resetToken:       token,
      resetTokenExpiry: { $gt: Date.now() },
    })
    if (!user) return res.json({ success: false, message: 'Invalid or expired reset link.' })

    user.password         = await bcrypt.hash(password, 10)
    user.resetToken       = undefined
    user.resetTokenExpiry = undefined
    await user.save()

    res.json({ success: true, message: 'Password reset successful.' })
  } catch (err) {
    res.json({ success: false, message: 'Something went wrong.' })
  }
}