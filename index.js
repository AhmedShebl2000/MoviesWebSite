import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg"
import passport from "passport";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";



const app = express();
const port = 3000;
env.config();

const API_KEY = process.env.API_KEY


app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(express.static("public"))

app.use(bodyParser.urlencoded({ extended: true }));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();


app.get("/", async (req, res) => {
    res.render("index.ejs");
})

app.get("/browse", async (req, res) => {
  res.render("browse.ejs");
})

app.get("/login", async (req, res) => {
  res.render("login.ejs");
})

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      console.log(err);
    }
    res.redirect("/");
  });
});



app.get("/favorites", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      var movieName = "";
      const result = await db.query("SELECT favorites FROM users WHERE email = $1", [req.user.email]);
      if (result.rows.length > 0) {
        movieName = result.rows[0].favorites;
        console.log(movieName);

        if (movieName !== null) {
          try {
            const dbResult = await axios.get(`https://www.omdbapi.com/?t=${movieName}&apikey=${API_KEY}`);
  
            const movieData = dbResult.data;
            res.render("favorites.ejs", {movieData});
  
          } 
  
          catch (error) {
          console.error("Error fetching movie data:", error);
          }
        } else {
          res.render("favorites.ejs");
        }
        
      } else {
        console.log("No favorites found for this user.");
      }



  } catch (err) {
    console.log("Error executing database query:", err);

    res.redirect("/favorites");

  }



  } else {
    res.redirect("/login");
  }
   
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/favorites",
  passport.authenticate("google", {
    successRedirect: "/favorites",
    failureRedirect: "/login",
  })
);


app.post("/get-details", async (req, res) => {

  const searchedMovie = req.body.movie;
  console.log(searchedMovie);

  
   try {
     const result = await axios.get(`https://www.omdbapi.com/?t=${searchedMovie}&apikey=${API_KEY}`);


     if (result.data.length === 0) {
       res.render("browse.ejs", { error: "Movie not found" });
       return;
     }

     const movieData = result.data;
     console.log(movieData);
     res.render("browse.ejs", {movieData});

   } 

  catch (error) {
    console.error("Error fetching movie data:", error);
  }
  


})




app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/favorites",
    failureRedirect: "/login",
  })
);

app.post("/add-favorite", async (req, res) => {

  const data = JSON.parse(req.body.movie);
  console.log(data.Title);

  if (req.user) {
    try {
      const result = await db.query("UPDATE users SET favorites = $1 WHERE email = $2",[data.Title, req.user.email]);
      // res.render("favorites.ejs", {movieData: data});
      res.redirect("/favorites")
    } catch (error) {
      console.log(error);
    }
  }
  else {
    res.render("login.ejs")
  }

})

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/favorites",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        console.log(profile);
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2)",
            [profile.email, "google"]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
