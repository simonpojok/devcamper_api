const crypto = require("crypto")
const ErrorResponse = require("../utils/errorResponse")
const asyncHandler = require("../middleware/async")
const User = require("../models/User")
const sendEmail = require("../utils/sendEmail")


// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
    const {name, email, password, role} = req.body

    const user = await User.create({
        name, email, password, role
    })

    await sendTokenResponse(user, 200, res)
})

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
    const {email, password} = req.body

    if (!email || !password) {
        return next(new ErrorResponse(`Please provide email and password`), 400)
    }

    const user = await User.findOne({email})
        .select('+password')

    if (!user) {
        return next(new ErrorResponse(`Invalid credentials`), 401)
    }

    const isMatch = await user.matchPassword(password)

    if (!isMatch) {
        return next(new ErrorResponse(`Invalid credentials`), 401)
    }

    await sendTokenResponse(user, 200, res)
})

// @desc    Get current logged in user
// @route   POST /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        return next(new ErrorResponse(`No user found with id`), 401)
    }
    res.status(200)
        .json({
            success: true,
            data: user
        })
})

// @desc    Forgot Password
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
    const user = await User.findOne({email: req.body.email})

    if (!user) {
        return next(new ErrorResponse(`No account exists for this email`), 404)
    }

    const token = user.getResetPasswordToken()

    await user.save({validateBeforeSave: false})
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/resetpassword/${token}`

    const message = `You are receiving this email because you ( or someone else ) has
    requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`

    try {
        await sendEmail({
            email: user.email,
            subject: 'Password Reset Token',
            message
        })

        return res.status(200)
            .json({
                success: true,
                data: 'Email sent'
            })
    } catch (e) {
        console.error(e)
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save({validateBeforeSave: false})
    }

    next(new ErrorResponse('Email could not be sent', 500))
})

// @desc    Reset Password
// @route   POST /api/v1/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
    const resetPasswordToken = crypto.createHash('sha256')
        .update(req.params.resettoken)
        .digest('hex')

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: {$gt: Date.now()}
    })

    if (!user) {
        return next(new ErrorResponse('Invalid token', 400))
    }

    user.password = req.body.password
    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined

    await user.save()

    await sendTokenResponse(user, 200, res)
})

// @desc    Update User Details
// @route   PUT /api/v1/auth/updatedetails
// @access  Private
exports.updateDetails = asyncHandler(async (req, res, error) => {
    const fieldsToUpdate = {
        name: req.body.name,
        email: req.body.email
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
        new: true,
        runValidators: true
    })

    return res.status(200)
        .json({
            success: true,
            data: user
        })
})

// @desc    Update Password
// @route   PUT /api/v1/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id)
        .select('+password')

    if (!(await user.matchPassword(req.body.password))) {
        return next(new ErrorResponse('Password is incorrect', 401))
    }

    user.password = req.body.newPassword
    await user.save()

    return await sendTokenResponse(user, 200, res)
})

// @desc    Log Users Out /Clear Cookies
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
    console.log(req.cookies)
    req.cookies.set('token', 'none', {
        expires: new Date(),
        httpOnly: true
    })

    res.status(200).json({
        success: true,
        data: {}
    })
})


const sendTokenResponse = async (user, statusCode, res) => {
    const token = await user.getSignedJwtToken()
    const options = {
        expires: new Date(Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }

    return res.status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            token
        })
}