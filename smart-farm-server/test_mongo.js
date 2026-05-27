const mongoose = require('mongoose');
const mongoUri = "mongodb+srv://huuduongle2002:Duongmb8602@cluster0.andq2.mongodb.net/smartfarm";
mongoose.connect(mongoUri)
    .then(async () => {
        const Device = mongoose.model('Device', new mongoose.Schema({}, { strict: false }));
        const devices = await Device.find({});
        console.log(JSON.stringify(devices, null, 2));
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
