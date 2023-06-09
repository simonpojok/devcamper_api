const express = require("express")
const dotenv = require("dotenv")
const colors = require("colors")
const morgan = require("morgan")
const path = require("path")
const cookieParse = require("cookie-parser")
const fileuploader = require("express-fileupload")
const sanitizer = require('express-mongo-sanitize')
const helmet = require('helmet')
const XSSClean = require('xss-clean')
const rateLimit = require('express-rate-limit')
const hpp = require('hpp')
const cors = require('cors')

const bootcampsRouter = require("./routes/bootcamps")
const coursesRouter = require('./routes/courses')
const authRouter = require("./routes/auth")
const reviewsRouter = require('./routes/reviews')
const connectDB = require("./config/db")
const errorHandler = require('./middleware/error')


dotenv.config({path: './config/config.env'})

const app = express();
connectDB()

// Dev Logging Middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'))
}

app.use(express.json())
app.use(cookieParse())
app.use(fileuploader({}))
app.use(sanitizer())
app.use(helmet())
app.use(XSSClean())
app.use(rateLimit({windowMs: 10 * 60 * 1000, max: 100}))
app.use(hpp())
app.use(cors())
app.use(express.static(path.join(__dirname, 'public')))

app.use('/api/v1/bootcamps', bootcampsRouter)
app.use('/api/v1/courses', coursesRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/reviews', reviewsRouter)

app.use(errorHandler)

const PORT = process.env.PORT || 5000

const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold)
})

process.on('unhandledRejection', (error, promise) => {
    console.log(`Error: ${error.message}`.red);
    server.close(() => process.exit(1))
})