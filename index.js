const environment = require('dotenv').config()
const fs = require('fs');
const path = require('path');
const request = require('request-promise');

var github = {
  token: null,
  agent: null,
  apiData: [],
  getAllTaggedRepos: function() {
    return request({
      "method": "GET",
      "uri": "https://api.github.com/search/repositories?q=topic:hack-for-la&sort=updated&order=desc",
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.agent
      }
    }).then(function(body) {
      body.items.forEach(function(project) {
        github.apiData.push({
          id: project.id,
          name: project.name,
          languages: { url: project.languages_url, data: [] },
          contributors: { url: [project.contributors_url], data: [] },
          repoEndpoint: project.url,
          issueComments: {url: [project.issue_comment_url.substring(0, project.issue_comment_url.length-9)], data: []}
        });
      });
    }).catch(function(err) {
      return err.message;
    });
  },
  getUntaggedRepos: function(ids) {
    // Check for repos not under hackforla but that we have the id for
    let extraRepos = [];
    for(id of ids){
      // Check if id is in github-data-json
      let found = false;
      for(project of github.apiData){
        if (project.id == id) found = true;
      }
      if (found) continue;
      extraRepos.push(
        request({
          "method": "GET",
          "uri": `https://api.github.com/repositories/${id}`,
          "json": true,
          "headers": {
            "Authorization": "token " + github.token,
            "User-Agent": github.agent
          }
        }).then(function(body){
          github.apiData.push({
            id: body.id,
            name: body.name,
            languages: { url: body.languages_url, data: [] },
            contributors: { url: [body.contributors_url], data: [] },
            repoEndpoint: body.url,
            issueComments: {url: project.issue_comment_url.substring(0, project.issue_comment_url.length-9), data: []}
          });
        }).catch(function(err){
          return err.message;
        })
      );
      return Promise.all(extraRepos);
    }
  },
  getLanguageInfo: function(url) {
    return request({
      "method": "GET",
      "uri": url,
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.agent
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
        "User-Agent": github.agent
      }
    }).then(function(body) {
      // return a list of contributors sorted by number of commits
      let contributors = [];
      body.forEach(function(user) {
        contributors.push({
          "id": user.id,
          "github_url": user.html_url,
          "avatar_url": user.avatar_url,
          "gravatar_id": user.gravatar_id,
          "contributions": user.contributions
        });
      });
      return Promise.resolve(contributors);
    }).catch(function(err) {
      return err.message;
    });
  },
  compareValues: function(key, order = 'asc') {
    return function innerSort(a, b) {
      if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
        // property doesn't exist on either object
        return 0;
      }

      const varA = (typeof a[key] === 'string')
            ? a[key].toUpperCase() : a[key];
      const varB = (typeof b[key] === 'string')
            ? b[key].toUpperCase() : b[key];

      let comparison = 0;
      if (varA > varB) {
        comparison = 1;
      } else if (varA < varB) {
        comparison = -1;
      }
      return (
        (order === 'desc') ? (comparison * -1) : comparison
      );
    };
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
      if(!body.organization || body.organization.login == 'hackforla') return {"repos": [], "issueCommentsUrls": []};
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
  },
  getRecentIssueComments: function(url) {
    // Get date 24 hours ago
    let date = new Date();
    date.setDate(date.getDate() - 1);
    return request({
      "method": "GET",
      "uri": `${url}?since=${date.toISOString()}`,
      "json": true,
      "headers": {
        "Authorization": "token " + github.token,
        "User-Agent": github.agent
      }
    }).then(function(body) {
      // return a list of commenters
      let commenters = [];
      body.forEach(function(comment) {
        commenters.push({
          "login": comment.user.login,
          "user_id": comment.user.id,
          "issue_url": comment.issue_url,
          "issue_id": comment.id,
          "created_at": comment.created_at,
          "updated_at": comment.updated_at,
          "github_url": comment.user.html_url,
          "avatar_url": comment.user.avatar_url,
          "gravatar_id": comment.user.gravatar_id
        });
      });
      return Promise.resolve(commenters);
    }).catch(function(err) {
      return err.message;
    });
  }
}

async function main(params) {
  console.log('In the async function main');
  github.token = params.token;
  github.agent = params.agent;

  untaggedRepos = [79977929];
  await github.getAllTaggedRepos();
  await github.getUntaggedRepos(untaggedRepos);
  // Get sibling links
  for(i = 0; i < github.apiData.length; i++){
    let {repos, issueCommentsUrls} = await github.getOrgLinks(github.apiData[i].repoEndpoint);
    
    github.apiData[i].contributors.url = github.apiData[i].contributors.url.concat(repos);
    github.apiData[i].contributors.url = github.apiData[i].contributors.url.filter(function(link, index, array){
      return array.indexOf(link) == index;
    });
    
    github.apiData[i].issueComments.url = github.apiData[i].issueComments.url.concat(issueCommentsUrls);
    github.apiData[i].issueComments.url = github.apiData[i].issueComments.url.filter(function(link, index, array){
      return array.indexOf(link) == index;
    });
  }
  let lps = [], ldone = false;
  let cps = [], cdone = false;
  let cmps = [], cmdone = false;

  for (i = 0; i < github.apiData.length; i++) {
    lps.push(github.getLanguageInfo(github.apiData[i].languages.url));
  }

  // Get language data ////////////////////////////////////
  Promise.all(lps)
    .then(function(ls) {
      for (i = 0; i < ls.length; i++) {
        github.apiData[i].languages.data = ls[i]
      }
      ldone = true
      if (cdone && cmdone) {
        console.log('Calling finish in languages work');
        finish();
      }
    })
    .catch(function(e) {
      console.log(e)
    });
  /////////////////////////////////////////////////////////
  
  // Get all contributors data ///////////////////////////
  for(i = 0; i < github.apiData.length; i++) {
    let contributorData = [] // Array to hold contributors data for each repo in project [i]
    for(link of github.apiData[i].contributors.url) {
      contributorData.push(github.getContributorsInfo(link));
    }
    cps.push(contributorData);
  }
  
  let contributorsDataPromises = [];
  for(i = 0; i < cps.length; i++) {
    (function(i) {
      let contributorsDataPromise = Promise.all(cps[i])
        .then(function(cs) {
          // We start off with an array of contributor arrays, so we flatten them into one
          let contributors = cs.flat();
          // Combine contributions from contributors that come up multiple times and keep track of their contributions
          for(z = 0; z < contributors.length - 1; z++) {
            let j = z + 1;
            while(j < contributors.length) {
              if(contributors[z].id == contributors[j].id) {
                contributors[z].contributions += contributors[j].contributions;
                contributors.splice(j, 1);
              } else {
                j++;
              }
            }
          }
          contributors.sort(github.compareValues('contributions', order = 'desc'));
          github.apiData[i].contributors.data = contributors;
        }).catch(function(err) {
          return err.message;
        });
      // Push the current Promise.all() that is working on the current contributors to the overall promise array
      contributorsDataPromises.push(contributorsDataPromise);
    })(i);
  }
  Promise.all(contributorsDataPromises)
    .then(function(contributorsData){
      cdone = true;
      if (ldone && cmdone) {
        console.log('Calling finish in Contributors work');
        finish();
      }
    })
    .catch(function(e){
      console.log(e.message);
    });
  //////////////////////////////////////////////////////////
  
  // Get recent repo issue comments ////////////////////////
  /*
  for (i = 0; i < github.apiData.length; i++) {
    cmps.push(github.getRecentIssueComments(github.apiData[i].issueComments.url));
  }
  Promise.all(cmps)
    .then(function(cs){
      for (i = 0; i < cs.length; i++) {
        currentProjectId = github.apiData[i].id;
        incomingComments = cs[i];
        console.log(github.apiData[i].name);
        console.log(incomingComments);
        // Get old comments data and add new data to it
        let oldData = JSON.parse(fs.readFileSync('github-data.json', 'utf8'));
        let dataExists = false;
        let issueCommentsData = {};
        for(project of oldData){
          if(project.id == currentProjectId){
            dataExists = true;
            issueCommentsData = project.issueComments.data;
          }
        }
        if(dataExists){
          for(comment of incomingComments){
            let userFound = false;
            for(j = 0; j < issueCommentsData.length; j++){
              if(comment.user_id == issueCommentsData[j].id){
                userFound = true;
                issueCommentsData[j].total++;
              }
            }
            if(!userFound){
              issueCommentsData.push({
                "login": comment.login,
                "total": 1,
                "id": comment.user_id,
                "github_url": comment.github_url,
                "avatar_url": comment.avatar_url,
                "gravatar_id": comment.gravatar_id
              });
            }
          }
        }
        github.apiData[i].issueComments.data = issueCommentsData;
      }
      cmdone = true
      if (ldone & cdone) {
        console.log('Calling finish in issue comments work');
        finish();
      }
    })
    .catch(function(e){
      console.log(e)
    });
  */
  //////////////////////////////////////////////////////////

  function finish(){
    let output = github.apiData.sort(github.compareValues('id'));
    // console.log(JSON.stringify(output, null, 2));
    // fs.writeFileSync('github-data.json', JSON.stringify(output, null, 2));
    fs.writeFileSync('github-data-comments.json', JSON.stringify(output, null, 2));
  }
}

let token = process.env.token;
main({ 
    'token': token,
    'agent': 'KianBadie' 
});