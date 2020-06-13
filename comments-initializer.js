const environment = require('dotenv').config()
const fs = require('fs');
const path = require('path');
const request = require('request-promise');
const querystring = require('querystring');

var github = {
  token: null,
  agent: null,
  apiData: [],

  getLocalData: function(){
      let data = fs.readFileSync('github-data.json', 'utf8');
      github.apiData = JSON.parse(data);
  },
  getAllComments: function(url){
    return request({
        "method": "GET",
        "uri": url,
        "json": true,
        "resolveWithFullResponse": true,
        "headers": {
          "Authorization": "token " + github.token,
          "User-Agent": github.agent
        }
      }).then(function(response) {
        // Get the total amount of pages in the response
        let comments = [];
        let lastPage = 1;
        if(response.headers.link){
          let links = response.headers.link.split(",");
          let lastPageString = links[1]; // NEED TO CHECK WHAT HAPPENS IF THERE IS ONLY ONE PAGE
          let lastPageTrim = lastPageString.split(";")[0].trim();
          let lastPageUrl = lastPageTrim.substring(1, lastPageTrim.length - 1);
          let parsed = querystring.parse(lastPageUrl, "?", "=");
          lastPage = parsed.page;
        }
        // Loop through every page possible in response
        for(i = 1; i <= lastPage; i++){
          let url = `${response.request.href}?page=${i}`;
          comments = comments.concat(github.getCommentsHelper(url));
        }
        return Promise.all(comments).then(function(result){
          return [].concat.apply([], result);
        });
      }).catch(function(err) {
          return err.message;
      });
  },
  getCommentsHelper: function(url){
    return request({
      "method": "GET",
      "uri": url,
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.agent
      }
    }).then(function(body){
      let result = [];
      for(comment of body){
        let { url, issue_url, id, user } = comment; 
        let { id: user_id, login: user_login, avatar_url: user_avatar_url, url: user_url, gravatar_id, html_url } = user; 
        result.push({
          url,
          issue_url,
          id,
          user: {
            user_id,
            user_login,
            user_avatar_url,
            user_url,
            gravatar_id,
            html_url
          }
        });
      }
      return Promise.resolve(result);
    }).catch(function(err){
      return err.message;
    });
  },
  parseComments: function(comments){
    try{
      let commenters = {};
      for(comment of comments){
        let { user } = comment;
        if(user.user_login in commenters){
          commenters[user.user_login].total+= 1 
        }
        else{
          commenters[user.user_login] = {
            'total': 1,
            'id': user.user_id,
            'github_url': user.html_url,
            'avatar_url': user.user_avatar_url,
            'gravatar_id': user.gravatar_id
          }
        }
      }

      // Build an array from the commenters data
      let commentersArray = [];
      for(commenter in commenters){
        let commenterObj = {
          "login": commenter,
          "total": commenters[commenter].total,
          "id": commenters[commenter].id,
          "github_url": commenters[commenter].github_url,
          "avatar_url": commenters[commenter].avatar_url,
          "gravatar_id": commenters[commenter].gravatar_id
        }
        commentersArray.push(commenterObj);
      }
      commentersArray.sort(function(a, b){
        if(a.total < b.total){
          return 1;
        }
        else if (a.total > b.total){
          return -1;
        }
        return 0;
      });
      return {
        totalCommenters: Object.keys(commenters).length,
        data: commentersArray
      };
    }catch(err){
      fs.writeFileSync('error.json', JSON.stringify(comments, null, 2));
      throw err.message;
    }
  }
}

async function main(params) {
  console.log('In the async function main');
  github.token = params.token;
  github.agent = params.agent;

  let issueCommentPromises = []
  github.getLocalData();
  for (i = 0; i < github.apiData.length; i++) {
    issueCommentPromises.push(github.getAllComments(github.apiData[i].issueComments.url));
  }
  Promise.all(issueCommentPromises)
    .then(function(issueComments){
      for (i = 0; i < issueComments.length; i++) {
        github.apiData[i].issueComments.allComments = github.parseComments(issueComments[i]);
      }
      finish();
    })
    .catch(function(err){
        console.log(err);    
    });

  function finish(){
    console.log('In finish');
    fs.writeFileSync('all-comments-data.json', JSON.stringify(github.apiData, null, 2));
  }
}

let token = process.env.token;
main({ 
    'token': token,
    'agent': 'KianBadie' 
});