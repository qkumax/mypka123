const express = require("express");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const session = require("express-session");
var methodOverride = require('method-override');
const {MongoClient, ObjectId} = require("mongodb");
require('dotenv').config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(methodOverride('_method'))
app.use(session({secret: "secret", resave: false, saveUninitialized: true, cookie: {secure: false, maxAge: 30 * 24 * 60 * 60 * 1000}}));
app.set("view engine", "ejs");

const PORT = 4000;
let db;

async function connect(){
    try{
        const connection = await MongoClient.connect(process.env.DB_LINK);
        db = connection.db();
    }catch(error){
        throw error;
    }
}
connect();

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});



app.get('/register', (req, res)=>{
    res.render("registerpage", {messages: [], name: '', phone: '', email: ''});
});

app.get('/login', (req, res)=>{
    res.render("loginpage", {messages: [], email: ''});
});


app.post('/register', async (req, res)=>{
    let {name, email, phone, password, cpassword} = req.body;
    let messages = [];
    const phoneNumberRegex = /^\+\d{11}$/;
    
    if(!name || !email || !phone ||!password || !cpassword){
        messages.push({message: "Please fill all fields"});
    }
    if(!phoneNumberRegex.test(phone)){
        messages.push({message: "Invalid phone number"});
    }
    if(password != cpassword){
        messages.push({message: "Passwords do not match"});
    }
    if(password.length < 4){
        messages.push({message: "Password has less than 4 characters"});
    }
    if(messages.length != 0){
        res.render("registerpage", {messages, name, phone, email});
    }else{
        let hashedpass = await bcrypt.hash(password, 10);
        try{
            let checkemail = await db.collection("users").findOne({"email": email});
            if(checkemail){
                messages.push({message: "Email is already in use"});
                res.render("registerpage", {messages, name, email: ''});
            }else{
                await db.collection("users").insertOne({"name": name, "email": email, "phone":phone, "password": hashedpass, "permissions": "user"});
                messages.push({message: "Successfully registered"});
                let info = await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: "Registration",
                    text: "You have successfully registered."
                });
                console.log("Message sent: " + info.messageId);
                res.render("registerpage",{messages, name: '', phone: '', email: ''});
            }
        }catch(error){
            res.status(500).send(error);
        }
    }
});

app.post('/login', async (req, res)=>{
    let {email, password} = req.body;
    let messages = [];
    if(!email || !password){
        messages.push({message: "Please fill all fields"});
    }
    try{
        let checkemail = await db.collection("users").findOne({"email": email});
        if(checkemail){
            const isMatch = await bcrypt.compare(password, checkemail.password);
            if(isMatch){
                req.session.user = checkemail;
                res.redirect("/reservation");
            }else{
                messages.push({message: "Wrong password"});
                res.render("loginpage", {messages, email});
            }
        }else{
            messages.push({message: "Such email is not registered"});
            res.render("loginpage", {messages, email});
        }
    }catch(error){
        res.status(500).send(error);
    }
});

app.post('/logout', async (req, res)=>{
    try{
        req.session.destroy();
        res.redirect('/login');
    }catch(error){
        res.status(500).send(error);
    }
});


app.get('/doctors', async (req, res)=>{
    try{
        if(!req.session.user){
            res.redirect('/login');
        }else{
            let doctors = await db.collection("doctors").find().toArray();
            if(req.session.user.permissions != 'user'){
                res.render("doctorspage", {doctors: doctors, admin: true});
            }else{
                res.render("doctorspage", {doctors: doctors, admin: false});
            }
        }
    }catch(error){
        res.status(500).send(error.toString());
    }
});

app.get('/doctors/:id', async (req,res)=>{
    try{
        if(!req.session.user){
            res.redirect('/login');
        }else{
            let id = req.params.id;
            let doctor = await db.collection("doctors").findOne({_id: new ObjectId(id)});
            if(!doctor){
                res.status(404).send("Doctor not found");
            }else{
                if(req.session.user.permissions != 'user'){
                    res.render("singledoctorpage", {doctor: doctor, admin: true});
                }else{
                    res.render("singledoctorpage", {doctor: doctor, admin: false});
                }
            }
        }   
    }catch(error){
        res.status(500).send(error.toString());
    }
});

app.post('/doctors', async (req, res)=>{
    let {image1, image2, image3, name_en, name_ru, desc_en, desc_ru} = req.body;
    try{
        const doctor = {image1, image2, image3, name_en, name_ru, desc_en, desc_ru, timestamp: new Date()};
        await db.collection("doctors").insertOne(doctor);
        res.redirect('/doctors')
        // res.status(200).send(doctor);
    }catch(error){
        res.status(500).send(error);
    }
});

app.put('/doctors/:id', async (req, res)=>{
    let {image1, image2, image3, name_en, name_ru, desc_en, desc_ru} = req.body;
    try{
        const id = req.params.id;
        const doctor = {image1, image2, image3, name_en, name_ru, desc_en, desc_ru, timestamp: new Date()};
        const result = await db.collection("doctors").updateOne({_id: new ObjectId(id)}, {$set: doctor});
        if(result.modifiedCount === 0){
            res.status(500).send("doctor not found");
        }else{
            res.redirect('/doctors');
        }
    }catch(error){
        res.status(500).send(error);
    }
});

app.delete('/doctors/:id', async (req, res)=>{
    try{
        const id = req.params.id;
        const result = await db.collection("doctors").deleteOne({_id: new ObjectId(id)});
        if(result.deletedCount === 0){
            res.status(500).send("doctor not found");
        }else{
            res.redirect('/doctors');
        }
    }catch(error){
        res.status(500).send(error);
    }
});

app.get('/reservation', async (req, res) => {
    try{
        if(!req.session.user){
            res.redirect('/login');
        }else{
            let doctors = await db.collection("doctors").find().toArray();
            res.render('reservation', {messages: [], doctors: doctors, name: req.session.user.name, phone: req.session.user.phone, email: req.session.user.email});
        }
    }catch(error){
        res.status(500).send(error);
    }
});

app.post('/reservation', async (req, res) => {
    try{
        let doctor = req.body['doctors-list'];
        let {name, phone, email, date} = req.body;
        const reservation = {name, phone, email, doctor, time: new Date(date)};
        await db.collection("schedule").insertOne(reservation);
        let info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: req.session.user.email,
            subject: "New appointment",
            text: "You have successfully set and appointment with " + doctor + " at " + date
        });
        console.log("Message sent: " + info.messageId);
        res.status(200).send("Successfully created a reservation");
    }catch(error){
        res.status(500).send(error);
    }
});

app.get('/about-us', (req, res) => {
    res.render("about");
});

//REST API


app.get('/api/reservations', async (req, res) => {
    try {
        const result = await db.collection('schedule').find().toArray();
        res.status(200).send(result);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});


app.get('/api/reservations/:id', async (req, res) => {
    try{
        const id = req.params.id;
        const result = await db.collection('schedule').findOne({_id: new ObjectId(id)});
        if(!result)
            res.status(404).send({error: "Reservation not found"});
        else
            res.status(200).send(result);
    }
    catch(error){
        res.status(500).send(error.toString());
    }
});

app.post('/api/reservations', async (req, res) => {
    try {
        const {name, phone, email, doctor, date} = req.body;
        if(!name || !phone || !email || !doctor || !date){
            return res.status(400).send({ error: "Name, phone, email, doctor and date are required" });
        }
        const reservation = {name, phone, email, doctor, time: new Date(date)};
        const result = await db.collection('schedule').insertOne(reservation);
        res.status(201).send(result);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

app.put('/api/reservations/:id', async (req, res) => {
    try{
        const id = req.params.id;
        const reservation = req.body;
        const result = await db.collection('schedule').updateOne({_id: new ObjectId(id)}, {$set: reservation});
        if(result.modifiedCount === 0)
            res.status(404).send({error: "Reservation not found"});
        else
            res.status(200).send(result);
    }
    catch(error){
        res.status(500).send(error.toString());
    }
});

app.delete('/api/reservations/:id', async (req, res) => {
    try{
        const id = req.params.id;
        const result = await db.collection('schedule').deleteOne({_id: new ObjectId(id)});
        if(result.deletedCount === 0)
            res.status(404).send({error: "Reservation not found"});
        else
            res.status(200).send(result);
    }
    catch(error){
        res.status(500).send(error.toString());
    }
});

app.listen(PORT, ()=>{
    console.log("Server runs at port " + PORT);
});