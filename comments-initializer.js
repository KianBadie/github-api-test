const environment = require('dotenv').config()
const fs = require('fs');
const path = require('path');
const request = require('request-promise');
const querystring = require('querystring');

var github = {
  token: null,
  agent: null,
  apiData: [],

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
      }).then(async function(response) {
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
        for(j = 1; j <= lastPage; j++){
          let url = `${response.request.href}?page=${j}`;
          let pageOfCommentData = await github.getCommentsHelper(url);
          comments = comments.concat(pageOfCommentData);
        }
        return comments;
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
  getOrgLinks: function(url) {
    // Check if repo belongs to a different org than hfla. If it does, return the contributor links of all repos in that org
    return request({
      "method": "GET",
      "uri": url,
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.agent
      }
    }).then(function(body) {
      if(!body.organization || body.organization.login == 'hackforla') return {"repos": [], "issueCommentsUrls": [body.issue_comment_url.substring(0, body.issue_comment_url.length-9)]};
      return github.getOrgLinksHelper(body.organization.repos_url);
    }).catch(function(err) {
      return err.message;
    });
  },
  getOrgLinksHelper: function(url) {
    // Helper method for getMoreContributorLinks that returns the contributor links of repos from a organization url
    return request({
      "method": "GET",
      "uri": url,
      "json": true,
      "headers": {
        "Authorization": "token" + github.token,
        "User-Agent": github.agent
      }
    }).then(function(body) {
      let repos = [];
      let issueCommentUrls = [];
      for(repo of body) {
        issueCommentUrls.push(repo.issue_comment_url.substring(0, repo.issue_comment_url.length-9));
        repos.push(repo.contributors_url);
      }
      return {
        "repos": repos,
        "issueCommentsUrls": issueCommentUrls
      }
    }).catch(function(err) {
      console.log(err.message);
    });
  }
}

async function main(params) {
  console.log('In the async function main');
  github.token = params.token;
  github.agent = params.agent;

  let issueCommentDataPromises = [];
  github.apiData = getLocalData();
  await initializeIssueCommentsField(github);
  for (i = 0; i < github.apiData.length; i++) {
    let issueCommentsData = [];
    console.log(`Fetching comment data for ${github.apiData[i].name}`);
    for(link of github.apiData[i].issueComments.url){
      let commentData = await github.getAllComments(link);
      issueCommentsData.push(commentData);
    }
    issueCommentDataPromises.push(issueCommentsData);
  }
  
  for(i = 0; i < issueCommentDataPromises.length; i++){
    let issueCommentData = issueCommentDataPromises[i];
    issueCommentData = issueCommentData.flat();
    issueCommentData = parseComments(issueCommentData);
    sortContributions(issueCommentData, 'contributions');
    github.apiData[i].issueComments.data = issueCommentData;
  }


  let dateRan = new Date();
  github.apiData.unshift(dateRan.toString());
  fs.writeFileSync('github-data.json', JSON.stringify(github.apiData, null, 2));
}

let token = process.env.token;
main({ 
    'token': token,
    'agent': 'KianBadie' 
});

function getLocalData(){
  let data = fs.readFileSync('github-data.json', 'utf8');
  return JSON.parse(data);
}

async function initializeIssueCommentsField(github){
  for(i = 0; i < github.apiData.length; i++){
    let {repos, issueCommentsUrls} = await github.getOrgLinks(github.apiData[i].repoEndpoint);
    
    github.apiData[i].issueComments = {
      url: [],
      data: []
    };
    github.apiData[i].issueComments.url = github.apiData[i].issueComments.url.concat(issueCommentsUrls);
    github.apiData[i].issueComments.url = github.apiData[i].issueComments.url.filter(function(link, index, array){
      return array.indexOf(link) == index;
    });
  }
}

function parseComments(comments){
  let commenters = {};
  for(comment of comments){
    let { user } = comment;
    if(user.user_id in commenters){
      commenters[user.user_id].contributions+= 1 
    }
    else{
      commenters[user.user_id] = {
        'contributions': 1,
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
      "contributions": commenters[commenter].contributions,
      "id": commenters[commenter].id,
      "github_url": commenters[commenter].github_url,
      "avatar_url": commenters[commenter].avatar_url,
      "gravatar_id": commenters[commenter].gravatar_id
    }
    commentersArray.push(commenterObj);
  }
  commentersArray.sort(function(a, b){
    if(a.contributions < b.contributions){
      return 1;
    }
    else if (a.contributions > b.contributions){
      return -1;
    }
    return 0;
  });
  return commentersArray;
}

function sortContributions(users, criteria){
  users.sort(function(a, b){
    if(a[criteria] < b[criteria]){
      return 1;
    }
    else if (a[criteria] > b[criteria]){
      return -1;
    }
    return 0;
  });
}

// Deep copy function I got from a medium article
const deepCopyFunction = (inObject) => {
  let outObject, value, key

  if (typeof inObject !== "object" || inObject === null) {
    return inObject // Return the value if inObject is not an object
  }

  // Create an array or object to hold the values
  outObject = Array.isArray(inObject) ? [] : {}

  for (key in inObject) {
    value = inObject[key]

    // Recursively (deep) copy for nested objects, including arrays
    outObject[key] = deepCopyFunction(value)
  }

  return outObject
}