const mongoose = require("mongoose")

const ReviewSchema = new mongoose.Schema({
    title: {
        type: String,
        trim: true,
        require: [true, 'Please add a title for the review'],
        maxLength: 100
    },
    text: {
        type: String,
        required: [true, 'Please a a text']
    },
    rating: {
        type: Number,
        min: 1,
        max: 10,
        required: [true, 'Please add a rating between 1 to 10']
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    bootcamp: {
        type: mongoose.Schema.ObjectId,
        ref: 'Bootcamp',
        required: true
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    }
})

ReviewSchema.index({bootcamp: 1, user: 1}, {unique: true})

ReviewSchema.statics.getAverageRating = async function (bootcampId) {
    const obj = await this.aggregate([
        {
            $match: {bootcamp: bootcampId}
        },
        {
            $group: {
                _id: '$bootcamp',
                averageRating: { $avg: '$rating'}
            }
        }
    ])

    try {
        await this.model('Bootcamp').findByIdAndUpdate(bootcampId, {
            averageRating: obj[0].averageRating
        })
    } catch (error) {
        console.error(error)
    }
}

ReviewSchema.post('save', function () {
    this.constructor.getAverageRating(this.bootcamp)
})

ReviewSchema.pre('deleteOne', function () {
    this.constructor.getAverageRating(this.bootcamp)
})

module.exports = mongoose.model('Review', ReviewSchema)