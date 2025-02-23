if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const bcrypt = require("bcrypt");
const morgan = require("morgan");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const nodemailer = require("nodemailer");
const multer = require("multer");
const { storage } = require("./cloud");
const upload = multer({ storage });
const newsKey = process.env.NEWSAPI_KEY;
const MongoStore = require("connect-mongo");
const utility = require("./helper/utilities");
const { authorize } = require("passport");
const ejsMate = require("ejs-mate");
const articleRoutes = require('./routes/articlesActivities');

//*****requiring all models*****
const Users = require("./models/user");
const Articles = require("./models/article");
const Reviews = require("./models/reviews");
const UserOtpDetails = require("./models/userOtpDetails");

//**************Connecting to mongoDB server****************
const dbUrl = process.env.DB_URL || "mongodb://localhost:27017/newsApp";
mongoose.connect("mongodb://localhost:27017/newsApp", {});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error : "));
db.once("open", function () {
  console.log("Database connected");
});

app.engine('ejs', ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

//************Setting up session store in mongodb***************
const secret = process.env.SECRET || "***finalYearProject***";
const store = new MongoStore({
  mongoUrl: "mongodb://localhost:27017/newsApp",
  secret,
  touchAfter: 24 * 60 * 60,
});
store.on("error", function (e) {
  console.log("SESSION STORE ERROR", e);
});

const sessionArgs = {
  store,
  name: "session",
  secret,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(session(sessionArgs));
app.use(flash());


app.get("/", async function (req, res) {
  let factor = 0;
  if (req.session.LoggedInUser) {
    factor = 1;
  } 
  res.render("homePage/home.ejs", 
    { 
      factor, 
      successMessage: req.flash("successMessage"), 
      title: "NewsBin home page", 
      infoMessage: req.flash("infoMessage") 
    }
  );
});


// articles endpoints router
app.use('/articles', articleRoutes);

//************************USER ADDING, DELETING AND UPDATING CODE***************************
app.get("/userRegistration", function (req, res) {
  res.render("users/userRegistration", { registrationError: req.flash("registrationError"), title: "User Registration" });
});

app.post("/userRegistration", upload.single("profilepic"), async function (req, res) {
    const { firstName, lastName, email, username, password, description } = req.body;
    const fullName = firstName.concat(" ").concat(lastName);
    const { path } = req.file;
    const usernameFound = await Users.findOne({ Username: username.trim() });
    if (usernameFound) {
      req.flash("registrationError", "The entered username is already taken.");
      res.redirect("/userRegistration");
    } else {
      const emailFound = await Users.findOne({ Email: email });
      if (emailFound != null) {
        req.flash("registrationError", "The entered email address is already in use.");
        res.redirect("/userRegistration");
      } else {
        const hashedPassword = await bcrypt.hash(password, 12);
        let userObject = {
          Name: fullName.trim(),
          Email: email.trim(),
          Username: username.trim(),
          Password: hashedPassword,
          Description: description.trim(),
          Profilepic: path,
        };
        const user = new Users(userObject);
        await user.save();
        req.session.LoggedInUser = user;

        let transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: utility.mailId,
            pass: utility.mailPassword,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        let mailOptions = {
          from: utility.mailId,
          to: `${email}`,
          subject: `Welcome ${fullName} ✔`,
          text: "Greetings from NewsBin!! We thank you from joining our website, check out our website for worlwide news from over 80,000 sources. Since you made an account so now you can also post your own articles on our site and let the world see what you have to share.",
        };
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            req.flash("infoMessage", "Account successfully created, but unable to send confirmation mail.")
          } else {
            console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
            req.flash("successMessage", "Account successfully created, you can now post articles on our site.");
          }
          res.redirect("/");
        });
      }
    }
  }
);

app.get("/logIn", function (req, res) {
  res.render("users/logIn.ejs", { logInError: req.flash("logInError"), successMessage: req.flash("successMessage") });
});

app.post("/logIn", async function (req, res) {
  const { password, username } = req.body;
  const user = await Users.findOne({ Username: username });
  if (user) {
    const validpw = await bcrypt.compare(password, user.Password);
    if (validpw) {
      req.session.LoggedInUser = user;
      const redirectTo = req.session.redirectTo ? req.session.redirectTo : "/";
      req.flash("successMessage", `Logged in as ${user.Name}.`);
      res.redirect(redirectTo);
    } else {
      req.flash("logInError", utility.invalidLoginErrMessage);
      res.redirect("/LogIn");
    }
  } else {
    req.flash("logInError", utility.invalidLoginErrMessage);
    res.redirect("/LogIn");
  }
});

app.get("/logOut", function (req, res) {
  req.session.LoggedInUser = null;
  req.session.redirectTo = null;
  req.flash("infoMessage", "Logged out of the system.");
  res.redirect("/");
});

app.get("/updateUser/:id", async function (req, res) {
  const { id } = req.params;
  const user = await Users.findById(id);
  const pageData = { 
    user: user, 
    errorMessage: req.flash("errorMessage"), 
    infoMessage: req.flash("infoMessage") 
  }
  res.render("users/updateUser.ejs", pageData);
});

app.post("/updateUser/:id", async function (req, res) {
  const { id } = req.params;
  const { fullName, username, password, desc } = req.body;
  const user = await Users.findById(id);
  if(user) {
    const passwordMatch = await bcrypt.compare(password, user.Password);
    if(user.Name === fullName.trim() && user.Username === username.trim() && user.Description === desc.trim() && passwordMatch) {
        req.flash("infoMessage", "No user data was updated");
        res.redirect(`/updateUser/${id}`);
    } else {
        if(username.trim() != user.Username) {
            const foundUser = await Users.findOne({ Username: username.trim() });
            if(foundUser) {
                req.flash("errorMessage", "This username is already taken. Please try a differcent one.");
                res.redirect(`/updateUser/${id}`);
            } else {
                const reviews = await Reviews.find({ user: user.Username });
                const articles = await Articles.find({ owner: user.Username });
                const likedArticles = await Articles.find({ likes: user.Username });
                // updating author name for articles
                if(articles != null) {
                  for(let article of articles) {
                    await Articles.findByIdAndUpdate(article._id, { owner: username.trim() });
                  }
                }
                // updating author name for reviews
                if(reviews != null) {
                  for(let review of reviews) {
                    await Reviews.findByIdAndUpdate(review._id, { user: username.trim() });
                  }
                }
                // updating likes array for articles which user has liked
                if(likedArticles != null) {
                  for(let article of likedArticles) {
                    let likesArray = article.likes;
                    likesArray.splice(likesArray.indexOf(user.Username), 1);
                    likesArray.push(username.trim());
                    await Articles.findByIdAndUpdate(article._id, { likes: likesArray });
                  }
                }
            }
        }
        const hashedPassword = await bcrypt.hash(password, 12); 
        const updatedUser = await Users.findByIdAndUpdate(id, {
            Name: fullName.trim(),
            Username: username.trim(),
            Password: hashedPassword,
            Description: desc.trim(),
        }, { new: true });
        req.session.LoggedInUser = updatedUser;
        req.flash("successMessage", "Your profile has been successfully updated.");
        res.redirect("/");
    }
  } else {
    req.flash("errorMessage", "Error in fetching user details. Please try again later.");
    res.redirect(`/updateUser/${id}`);
  }
});

app.get("/openForgotPasswordForm", function(req, res) {
  res.render("users/forgotPassword.ejs", { errorMsg: req.flash("errorMsg"), 
    infoMsg: req.flash("infoMsg"), 
    username: req.flash("username"),
    newPassword: req.flash("newPassword"),
    confirmPassword: req.flash("confirmPassword"),
    title: "Forgot password form"
  });
})

app.post("/generateOtpForForgotPassword", async function(req, res) {
  const { username, newPassword, confirmPassword } = req.body;
  const checkUserExists = await Users.findOne({ Username: username.trim() });
  if(checkUserExists) {
    if(newPassword.trim() != confirmPassword.trim()) {
      req.flash("errorMsg", "Confirm password does not match the new password");
      res.redirect("/openForgotPasswordForm");
    }

    // generating 4 digit otp and saving/updating it to DB 
    let generatedOtp = utility.generateFourDigitOtp();
    const checkIfOtpExistsForUser = await UserOtpDetails.findOne({ username: username.trim() });
    if(checkIfOtpExistsForUser != null) {
      await UserOtpDetails.findByIdAndUpdate(checkIfOtpExistsForUser._id, { 
        otp: generatedOtp,
        newPassword: newPassword.trim(), 
        generationTime: new Date() 
      });
    } else {
      const otpDetails = new UserOtpDetails({
        username: username.trim(),
        otp: generatedOtp,
        newPassword: newPassword.trim(),
        generationTime: new Date()
      })
      await otpDetails.save();
    }

    // sending the saved otp to user via mail
    let transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: utility.mailId,
        pass: utility.mailPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    let mailOptions = {
      from: utility.mailId,
      to: `${checkUserExists.Email}`,
      subject: "Forgot Password",
      text: `Here is your one time otp for resetting your account password: ${generatedOtp}`,
    };
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("error in sending mail", error);
      } else {
        req.flash("infoMsg","Please enter the OTP sent on your email address");
        req.flash("username", checkUserExists.Username);
        req.flash("newPassword", newPassword.trim());
        req.flash("confirmPassword", confirmPassword.trim());
        res.redirect("/openForgotPasswordForm");
      }
    });
  } else {
    req.flash("errorMsg", "Entered username is invalid");
    res.redirect("/openForgotPasswordForm");
  }
})

app.post("/checkOtpForResettingPassword/:username", async function(req, res) {
  const { username } = req.params;
  const { OTP } = req.body;
  const otpDetails = await UserOtpDetails.findOne({ username: username.trim() });
  if(otpDetails) {
    let savedOTP = otpDetails.otp;
    if(savedOTP == OTP) {
      const hashedPassword = await bcrypt.hash(otpDetails.newPassword, 12);
      const user = await Users.findOne({ Username: username });
      await Users.findByIdAndUpdate(user._id, { Password: hashedPassword });
      req.flash("successMessage", "Your password reset was successfull.")
      res.redirect("/LogIn");
    } else {
      req.flash("errorMsg", "Please enter valid OTP");
      res.redirect("/openForgotPasswordForm");
    }
  } else {
    console.log(`OTP for this user id not found: ${username}`);
    req.flash("errorMsg", "Internal Server Error");
    res.redirect("/openForgotPasswordForm");
  }
})

app.post("/deleteUser/:id", async function (req, res) {
  const { id } = req.params;
  const user = await Users.findById(id);
  const reviews = await Reviews.find({ user: user.Username });
  const articles = await Articles.find({ owner: user.Username });
  const allArticles = await Articles.find();
  for (let review of reviews) {
    let temp = review._id.toString();
    let x;
    for (let article of allArticles) {
      x = article._id.toString();
      await Articles.findByIdAndUpdate(x, { $pull: { reviews: temp } });
    }
    await Reviews.findByIdAndDelete(temp);
  }
  for (let article of articles) {
    if (article.reviews.length != 0) {
      for (let review of article.reviews) {
        let temp = review.toString();
        await Reviews.findByIdAndDelete(temp);
      }
    }
    await Articles.findByIdAndDelete(article._id.toString());
  }
  await Users.findByIdAndDelete(id);
  req.session.LoggedInUser = null;
  req.flash("successMessage", "Your account has been successfully deleted.");
  res.redirect("/");
});

//**************************DISPLAY PROFILE CODE**********************
app.get("/profile", async function (req, res) {
  const user = req.session.LoggedInUser;
  const posts = await Articles.find({ owner: user.Username }).sort({ _id: -1 });
  let result = [];
  for (let x of posts) {
    let temp = x.content.slice(0, 175) + (x.content.length > 175 ? "..." : "");
    result.push(temp);
  }
  res.render("users/profile.ejs", { user, posts, result, title: `${user.Name}'s profile` });
});

app.get("/profile/:owner", async function (req, res) {
  const { owner } = req.params;
  let factor;
  const user = await Users.findOne({ Username: owner });
  const posts = await Articles.find({ owner: owner }).sort({ _id: -1 });
  if (req.session.LoggedInUser) {
    factor = 1;
  } else {
    factor = 0;
  }
  let result = [];
  for (let x of posts) {
    let temp = x.content.slice(0, 175) + (x.content.length > 175 ? "..." : "");
    result.push(temp);
  }
  res.render("users/otherUserProfile.ejs", { user, posts, result, factor, title: `${user.Name}'s profile` });
});

//**************************ADDING AND DELETING REVIEWS****************************
app.post("/addReview/:id", async function (req, res) {
  const { id } = req.params;
  const article = await Articles.findById(id);
  const commentUser = req.session.LoggedInUser;
  const review = new Reviews({
    rating: req.body.rating,
    body: req.body.comment,
    user: commentUser.Username,
  });
  await review.save();
  article.reviews.push(review);
  await article.save();
  req.flash("successMessage", "Your comment has been added");
  res.redirect(`/articles/${id}`);
});

app.post("/deleteReview/:aid/:rid", async function (req, res) {
  const { aid, rid } = req.params;
  await Articles.findByIdAndUpdate(aid, { $pull: { reviews: rid } });
  await Reviews.findByIdAndDelete(rid);
  req.flash("successMessage", "The comment has been deleted");
  res.redirect(`/articles/${aid}`);
});


//********************************************DAILY NEWS DATA CODE************************************
app.get("/news", async function (req, res) {
  const xhr = new XMLHttpRequest();
  xhr.open(
    `GET`,
    `https://newsapi.org/v2/everything?q=india&apiKey=${newsKey}`,
    false
  );
  xhr.onload = function () {
    if (this.status == 200) {
      const data = JSON.parse(this.responseText);
      const articles = data.articles;
      let temp = [];
      for (let x of articles) {
        let str = "";
        for (let i = 11; i < x.publishedAt.length - 1; i++) {
          str = str + x.publishedAt[i];
        }
        temp.push(str);
      }
      res.render("news/homeNews.ejs", {
        articles,
        temp,
        error: req.flash("error"),
      });
    } else {
      console.log("error while fetching the news");
      req.flash("error", "error while fetching the news.");
      res.redirect("/news");
    }
  };
  xhr.send();
});

app.post("/headlines/country", function (req, res) {
  country = req.body.selectedCountry;
  const xhr = new XMLHttpRequest();
  xhr.open(
    `GET`,
    `https://newsapi.org/v2/top-headlines?country=${country}&apiKey=${newsKey}`,
    false
  );
  xhr.onload = function () {
    if (this.status == 200) {
      const data = JSON.parse(this.responseText);
      const articles = data.articles;
      let temp = [];

      for (let x of articles) {
        let str = "";
        for (let i = 11; i < x.publishedAt.length - 1; i++) {
          str = str + x.publishedAt[i];
        }
        temp.push(str);
      }
      res.render("news/countryNews.ejs", { articles, temp, country });
    } else {
      console.log("error while fetching the news");
      req.flash("error", "error while fetching the news.");
      res.redirect("/news");
    }
  };
  xhr.send();
});

app.get("/category/:cat/:cnt", function (req, res) {
  const { cat, cnt } = req.params;
  const xhr = new XMLHttpRequest();
  xhr.open(
    `GET`,
    `https://newsapi.org/v2/top-headlines?country=${cnt}&category=${cat}&apiKey=${newsKey}`,
    false
  );
  xhr.onload = function () {
    if (this.status == 200) {
      const data = JSON.parse(this.responseText);
      const articles = data.articles;
      let temp = [];

      for (let x of articles) {
        let str = "";
        for (let i = 11; i < x.publishedAt.length - 1; i++) {
          str = str + x.publishedAt[i];
        }
        temp.push(str);
      }
      res.render("news/categoryNews.ejs", { articles, temp, cnt });
    } else {
      console.log("error while fetching the news");
      req.flash("error", "error while fetching the news.");
      res.redirect("/news");
    }
  };
  xhr.send();
});

app.post("/everything", async function (req, res) {
  const subject = req.body.topic;
  const xhr = new XMLHttpRequest();
  xhr.open(
    `GET`,
    `https://newsapi.org/v2/everything?q=${subject}&apiKey=${newsKey}`,
    false
  );
  xhr.onload = function () {
    if (this.status == 200) {
      const data = JSON.parse(this.responseText);
      const articles = data.articles;
      if (articles.length != 0) {
        let temp = [];

        for (let x of articles) {
          let str = "";
          for (let i = 11; i < x.publishedAt.length - 1; i++) {
            str = str + x.publishedAt[i];
          }
          temp.push(str);
        }
        res.render("news/subjectNews.ejs", { articles, temp, subject });
      } else {
        req.flash("error", "Unable to fetch news on the typed subject.");
        res.redirect("/news");
      }
    } else {
      console.log("error while fetching the news");
      req.flash("error", "error while fetching the news.");
      res.redirect("/news");
    }
  };
  xhr.send();
});

const port = process.env.PORT || 3000;
app.listen(port, function (req, res) {
  console.log(`Server established on port ${port}`);
});
