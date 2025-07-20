import mongoose from 'mongoose';

const tipSchema = new mongoose.Schema({
    tipText: {
        type: String,
        required: [true, 'A tip must have text content.'],
        trim: true,
    },
    generatedOn: {
        type: Date,
        required: true,
        unique: true, // Ensures only one tip document can exist per day.
        index: true, // Improves query performance for finding tips by date.
    },
}, {
    timestamps: true, // Automatically adds createdAt and updatedAt fields.
});

tipSchema.pre('save', function (next) {
    if (this.isNew || this.isModified('generatedOn')) {
        const date = new Date(this.generatedOn);
        this.generatedOn = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
    next();
});

const Tip = mongoose.model('Tip', tipSchema);

export default Tip;
