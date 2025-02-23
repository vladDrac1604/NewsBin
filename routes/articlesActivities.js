const express = require('express');
const router = express.Router({ margeParams: true });
const Users = require("../models/user");
const Articles = require("../models/article");
const Reviews = require("../models/reviews");
const utility = require("../helper/utilities");
const multer = require("multer");
const { storage } = require("../cloud");
const upload = multer({ storage });
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const newsKey = process.env.NEWSAPI_KEY;


router.get("/", async function (req, res) {
    let factor = 0;
    let user = null;
    let articles = await Articles.find({});
    articles = utility.configureDisplayContent(articles);
    articles.reverse();
    if (req.session.LoggedInUser) {
      factor = 1;
      user = req.session.LoggedInUser;
    }
    const pageData = {
      articles: articles,
      factor: factor,
      user: user,
      successMessage: req.flash("successMessage"),
      infoMessage: req.flash("infoMessage"),
      title: "View All Articles"
    };
    res.render("articles/showAllArticles.ejs", pageData);
});

router.post("/findBySearhTerm", async function (req, res) {
    let factor = 0;
    let user = null;
    const searchTerm = req.body.searchTerm;
    let articles = await Articles.find({ $or: [
        { title: new RegExp(searchTerm, "i") },
        { owner: new RegExp(searchTerm, "i") },
        { content: new RegExp(searchTerm, "i") }
    ]});
    articles = utility.configureDisplayContent(articles);
    articles.reverse();
    if (req.session.LoggedInUser) {
      factor = 1;
      user = req.session.LoggedInUser;
    }
    res.render("articles/articlesBySearchTerm.ejs", {
      articles,
      factor,
      user,
      successMessage: req.flash("successMessage"),
      title: "Search Article"
    });
});

router.get("/favourites/:id", async function (req, res) {
    const id = req.params.id;
    let favourites = [];
    const user = await Users.findById(id);
    let articles = await Articles.find({});
    for (let article of articles) {
      for (let temp of article.likes) {
        if (temp == user.Username) {
          favourites.push(article);
        }
      }
    }
    favourites.reverse();
    let result = [];
    for (let x of favourites) {
      let temp =
        x.content.slice(0, 475) + (x.content.length > 475 ? "........" : "");
      result.push(temp);
    }
    res.render("articles/favourites.ejs", { user, favourites, result, title: "Liked posts" });
});

router.post("/delete/:id", async function (req, res) {
  const { id } = req.params;
  const article = await Articles.findById(id);
  if (article.reviews.length != 0) {
    for (let x of article.reviews) {
      let temp = x.toString();
      await Reviews.findByIdAndDelete(temp);
    }
  }
  await Articles.findByIdAndDelete(id);
  req.flash("successMessage", "The article has been successfully deleted.");
  res.redirect("/");
});

router.get("/edit/:id/:ownerName", async function (req, res) {
    const { id, ownerName } = req.params;
    const article = await Articles.findById(id);
    res.render("articles/updateArticle.ejs", { article, ownerName, title: `Edit Article - ${article.title}` });
});

router.post("/edit/:id", upload.single("articlePic"), async function (req, res) {
    const { id } = req.params;
    const { body, subject } = req.body;
    const { path } = req.file;
    const updatedArticle = await Articles.findByIdAndUpdate(id, {
      title: subject.trim(),
      content: body.trim(),
      image: path,
    });
    req.flash("successMessage", "Your Article has been successfully updated");
    res.redirect(`/articles/${id}`);
});

router.get("/addToFavourites/:id/:username", async function (req, res) {
    let temp = 1;
    const aId = req.params.id;
    const username = req.params.username;
    const article = await Articles.findById(aId);
    for (let like of article.likes) {
      if (like == username) {
        temp = 0;
        break;
      }
    }
    if (temp == 1) {
      article.likes.push(username);
      await article.save();
      req.flash("infoMessage", "Post added to your favourites.");
      res.redirect("/articles");
    } else {
      await Articles.findByIdAndUpdate(aId, { $pull: { likes: username } });
      req.flash("infoMessage", "Post removed from your favourites.");
      res.redirect("/articles");
    }
});

router.get("/postArticle", function (req, res) {
  req.session.redirectTo = req.originalUrl;
  if (req.session.LoggedInUser) {
    let topic = "india headlines";
    let user = req.session.LoggedInUser;
    const xhr = new XMLHttpRequest();
    xhr.open(`GET`, `https://newsapi.org/v2/everything?q=${topic}&apiKey=${newsKey}`, false);
    xhr.onload = function () {
      if (this.status == 200) {
        const data = JSON.parse(this.responseText);
        const displayArticle = utility.getRandomArticle(data.articles, data.totalResults);
        res.render("articles/writeArticle.ejs", { 
          displayArticle, 
          user, 
          title: "Article Posting",
          success: req.flash("successMessage")
         });
      } else {
        req.flash("error", "error while fetching the news.");
        res.redirect("/news");
      }
    };
    xhr.send();
  } else {
    req.flash("logInError", "You have to be logged in to post an article.");
    res.redirect("/LogIn");
  }
});
  
router.post("/postArticle", upload.single("articlePic"), async function (req, res) {
    const { subject, body } = req.body;
    const { path } = req.file;
    let today = utility.getCurrentDate();
    const article = new Articles({
      title: subject.trim(),
      content: body.trim(),
      image: path,
      uploadDate: today,
      owner: req.session.LoggedInUser.Username,
    });
    await article.save();
    req.flash("successMessage", "The article has been successfully uploaded.");
    res.redirect("/articles");
});

router.get("/:id", async function (req, res) {
    const { id } = req.params;
    const article = await Articles.findById(id).populate("reviews");
    const blogger = await Users.findOne({ Username: article.owner });
    const ownerName = blogger.Name;
    let user;
    let factor;
    let authorizedUser = 0;
    if (req.session.LoggedInUser) {
      user = req.session.LoggedInUser;
      factor = 1;
      if (user.Username == article.owner) authorizedUser = 1;
    } else {
      user = null;
      factor = 0;
    }
    res.render("articles/showSingleArticle", {
      article,
      user,
      authorizedUser,
      factor,
      ownerName,
      successMessage: req.flash("successMessage"),
      errorMessage: req.flash("errorMessage"),
      title: `Read Article - ${article.title}`
    });
});


module.exports = router;