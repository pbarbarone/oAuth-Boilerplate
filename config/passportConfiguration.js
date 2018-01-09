var passport = require('passport');
var localStrategy = require('passport-local').Strategy;
var facebookStrategy = require('passport-facebook').Strategy;
var db = require('../models');
require('dotenv').config();

passport.serializeUser(function(user, callback){
	callback(null, user.id);
});

passport.deserializeUser(function(id, callback){
	db.user.findById(id).then(function(user){
		callback(null, user);
	}).catch(function(err){
		callback(err, null);
	});
});

passport.use(new localStrategy({
	usernameField: 'email', //assumes usner is default login field,
	passwordField: 'password'
}, function(email,password, callback){
	db.user.findOne({
		where: { email: email } //where email is what we passed in/what was typed
	}).then(function(user){ //if user is found by their email...
		if(!user || !user.isValidPassword(password)){ //if user is not found by email
			callback(null, false);
		} 
		else { //if user valid and the user has correct PW
			callback(null,user);
		}
	}).catch(function(err){
		callback(err, null);
	})
}));

/*OAUTH CONFIG*/
passport.use(new facebookStrategy({
	clientID: process.env.FACEBOOK_APP_ID,
	clientSecret: process.env.FACEBOOK_APP_SECRET,
	callbackURL: process.env.BASE_URL + '/auth/callback/facebook',
	profileFields: ['id', 'email', 'displayName'], //defining what info we want back from facebook
	enableProof: true 
}, function(accessToken, refreshToken, profile, callback){
	//insert or access facebook user in user table
	//See if we have an email address we can use to identify user
	var facebookEmail = profile.emails ? profile.emails[0].value : null;

	//See if the email exists in users table
	db.user.findOne({
		where: {email: facebookEmail}
	}).then(function(existingUser){
		//This user has logged in before!
		if(existingUser && facebookEmail){
			existingUser.updateAttributes({
				facebookId: profile.id,
				facebookToken: accessToken
			}).then(function(updatedUser){
				callback(null, updatedUser);
			}).catch(callback);
		} else {
			// the person is just new, we need to create an entry for them in the users table
			//Parse user name (account for multiple names)
			var usernameArr = profile.displayName.split(' ');

			db.user.findOrCreate({
				where: {facebookId: profile.id},
				defaults: {
					facebookToken: accessToken,
					email: facebookEmail,
					firstname: usernameArr[0],
					lastname: usernameArr[usernameArr.length - 1],
					username: profile.displayName
				}
			}).spread(function(user, wasCreated){
				if(wasCreated){
					//Expected case: they were new and we created them in users table
					callback(null, user);
				} else {
					//Unexpected case: they were not new afterall, we just need to update token
					user.facebookToken = accessToken;
					user.email = facebookEmail;
					user.save().then(function(updatedUser){
						callback(null, updatedUser);
					}).catch(callback);
				}
			}).catch(callback);
		 }
	})
}));












module.exports = passport;