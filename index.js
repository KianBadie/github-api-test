const fs = require('fs');
const request = require('request-promise');
const querystring = require('querystring');
const env = require('dotenv').config();

var github = {
  token: null,
  userAgent: null,
  apiData: [],
  getAllTaggedRepos: function() {
    return request({
      "method": "GET",
      "uri": "https://api.github.com/search/repositories?q=topic:hack-for-la&sort=updated&order=desc",
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.userAgent
      }
    }).then(function(body) {
      body.items.forEach(function(project) {
        github.apiData.push({
          id: project.id,
          name: project.name,
          languages: { url: project.languages_url, data: [] },
          contributors: { url: project.contributors_url, data: [] },
          comments: {url: project.issue_comment_url.substring(0, project.issue_comment_url.length-9), data: []}
        });
      });
    }).catch(function(err) {
      return err.message;
    });
  },
  getLanguageInfo: function(url) {
    return request({
      "method": "GET",
      "uri": url,
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.userAgent
      }
    }).then(function(body) {
      // The body contains an ordered list of languge + lines of code.
      // We care about the order of the names but not the number of lines of code.
      return Promise.resolve(Object.keys(body));
    }).catch(function(err) {
        return err.message;
    });
  },
  getContributorsInfo: function(url) {
    return request({
      "method": "GET",
      "uri": url,
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.userAgent
      }
    }).then(function(body) {
      // return a list of contributors sorted by number of commits
      let contributors = [];
      body.forEach(function(user) {
        contributors.push({
          "id": user.id,
          "github_url": user.html_url,
          "avatar_url": user.avatar_url,
          "gravatar_id": user.gravatar_id
        });
      });
      return Promise.resolve(contributors);
    }).catch(function(err) {
        return err.message;
    });
  },
  getIssues: function(url){
    return request({
      "method": "GET",
      "uri": url + "?state=all",
      "json": true,
      "resolveWithFullResponse": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.userAgent
      }
    }).then(async function(response){
      // Get the total amount of pages in the response
      let issues = [];
      let links = response.headers.link.split(",");
      let lastPageString = links[1]; // NEED TO CHECK WHAT HAPPENS IF THERE IS ONLY ONE PAGE
      let lastPageTrim = lastPageString.split(";")[0].trim();
      let lastPageUrl = lastPageTrim.substring(1, lastPageTrim.length - 1);
      let parsed = querystring.parse(lastPageUrl, "&", "=");
      let lastPage = parsed.page;
      // Loop through every page possible in response
      for(i = 1; i <= lastPage; i++){
        let url = `${response.request.href}&page=${i}`;
        issues = issues.concat(github.getIssuesHelper(url));
      }
      return Promise.all(issues).then(function(result){
        return [].concat.apply([], result);
      });
    }).catch(function(err){
      return err.message;
    });
  },
  getIssuesHelper: function(url){
    return request({
      "method": "GET",
      "uri": url,
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.userAgent
      }
    }).then(function(body){
      let result = [];
      for(issue of body){
        let { url, comments_url, id, number, user, comments } = issue;
        let { login: user_login, avatar_url: user_avatar_url, url: user_url } = user;
        result.push({
          url,
          comments_url,
          id,
          number,
          user: {
            user_login,
            user_avatar_url,
            user_url
          },
          comments
        });
      }
      return Promise.resolve(result);
    }).catch(function(err){
      return err.message;
    });
  },
  getComments: function(url){
    return request({
      "method": "GET",
      "uri": url,
      "json": true,
      "resolveWithFullResponse": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.userAgent
      }
    }).then(function(response) {
      // Get the total amount of pages in the response
      let comments = [];
      let links = response.headers.link.split(",");
      let lastPageString = links[1]; // NEED TO CHECK WHAT HAPPENS IF THERE IS ONLY ONE PAGE
      let lastPageTrim = lastPageString.split(";")[0].trim();
      let lastPageUrl = lastPageTrim.substring(1, lastPageTrim.length - 1);
      let parsed = querystring.parse(lastPageUrl, "?", "=");
      let lastPage = parsed.page;
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
        "User-Agent": github.userAgent
      }
    }).then(function(body){
      let result = [];
      for(comment of body){
        let { url, issue_url, id, user } = comment;
        //Wierd bug happening wwhen adding "id: user_id" 
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
  getCommenters: function(comments){
    if(comments == "Cannot read property 'split' of undefined"){ return }
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
  }
}

async function main(params) {
  console.log('In the async function main');
  github.token = params.token;
  github.userAgent = params.agent;

  await github.getAllTaggedRepos();
  let lps = [], ldone = false
  let cps = [], cdone = false
  let icps = [], icdone = false
  for (i = 0; i < github.apiData.length; i++) {
    lps.push(github.getLanguageInfo(github.apiData[i].languages.url));
    cps.push(github.getContributorsInfo(github.apiData[i].contributors.url));
    icps.push(github.getComments(github.apiData[i].comments.url));
  }
  Promise.all(lps)
    .then(function(ls) {
      for (i = 0; i < ls.length; i++) {
        github.apiData[i].languages.data = ls[i]
      }
      ldone = true
      if (cdone) finish()
    })
    .catch(function(e) {
      console.log(e)
    });
  Promise.all(cps)
    .then(function(cs) {
      for (i = 0; i < cs.length; i++) {
        github.apiData[i].contributors.data = cs[i]
      }
      cdone = true
      if (ldone) finish()
    })
    .catch(function(e) {
      console.log(e)
    });
 Promise.all(icps)
    .then(function(ics){
      for (i = 0; i < ics.length; i++) {
        github.apiData[i].comments.data = ics[i];
        github.apiData[i].commenters = github.getCommenters(ics[i]);
      }
      finish()
    })
    .catch(function(e){
      console.log(e);
    });

  function finish(){
    fs.writeFileSync('github-data.json', JSON.stringify(github.apiData, null, 2));
  }
}

async function test(params) {
  console.log('in async function test');
  github.token = params.token;
  github.userAgent = params.agent;

  let data = JSON.parse(fs.readFileSync('github-data.json', 'utf8'));
  for (i = 0; i < data.length; i++) {
    let commentersData = github.getCommenters(data[i].comments.data);
    data[i].commenters = commentersData;
  }
  fs.writeFileSync('test-data.json', JSON.stringify(data, null, 2));
}

let token = process.env.token;
// test({ 
//     'token': token,
//     'agent': 'KianBadie' 
// });
main({ 
    'token': token,
    'agent': 'KianBadie' 
});