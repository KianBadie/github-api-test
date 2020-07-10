const environment = require('dotenv').config();
const axios = require('axios');
const querystring = require('querystring');

const token = process.env.token;
const org = process.env.org;
const repoId = parseInt(process.env.repoId);

const config = {
    headers: {
        Authorization: `token ${token}`
    }
};

async function main(){
    let commentsData = await getAllIssueCommentsFromOrg(org);
    // let commentsData = await getAllIssueCommentsFromRepo(repoId);
    console.log(commentsData);
}

async function getAllIssueCommentsFromOrg(org){
    let orgRes = await axios.get(`https://api.github.com/users/${org}`, config);
    let orgData = orgRes.data;

    let reposRes = await axios.get(orgData.repos_url, config);
    let reposData = reposRes.data;
    
    let allCommentContributions = [];
    for(repo of reposData){
        let repoIssueComments = await getAllIssueCommentsFromRepo(repo.id);
        allCommentContributions = allCommentContributions.concat(repoIssueComments);
    }

    let commentsDictionary = {};
    for(contributor of allCommentContributions){
        if(commentsDictionary.hasOwnProperty(contributor.userId)){
            commentsDictionary[contributor.userId].contributions += contributor.contributions;
        } else {
            commentsDictionary[contributor.userId] = {
                contributions: contributor.contributions,
                userId: contributor.userId,
                userLogin: contributor.userLogin
            };
        }
    }

    let aggregateData = [] 
    for(contributor in commentsDictionary){
        aggregateData.push(commentsDictionary[contributor]);
    }

    aggregateData.sort(function compare(a, b){
        if(a.contributions > b.contributions){
            return -1;
        } else if(a.contributions < b.contributions){
            return 1;
        }
        return 0;
    });

    return aggregateData;
}

async function getAllIssueCommentsFromRepo(repoId){
    let repoRes = await axios.get(`https://api.github.com/repositories/${repoId}`, config);
    let repoData = repoRes.data;
    
    let issueCommentUrl = repoData.issue_comment_url.substring(0, repoData.issue_comment_url.length-9);
    let issueCommentRes = await axios.get(issueCommentUrl, config);
    let lastPage = 1;
    if(issueCommentRes.headers.link){
        let lastPageString = issueCommentRes.headers.link.split(',')[1].split(';')[0].trim();
        let lastPageLink = lastPageString.substring(1, lastPageString.length - 1);
        lastPage = querystring.parse(lastPageLink, "?", "=").page;
    }

    let repoIssueComments = [];
    for(i = 1; i <= lastPage; i++){
        let commentPageRes = await axios.get(`${issueCommentUrl}?page=${i}`, config);
        let commentPageData = commentPageRes.data;
        repoIssueComments = repoIssueComments.concat(commentPageData);
    }

    let commentsDictionary = {};
    for(comment of repoIssueComments){
        let { user } = comment;
        if(commentsDictionary.hasOwnProperty(user.id)){
            commentsDictionary[user.id].contributions++;
        } else {
            commentsDictionary[user.id] = {
                contributions: 1,
                userId: user.id,
                userLogin: user.login
            };
        }
    }

    let aggregateData = [] 
    for(contributor in commentsDictionary){
        aggregateData.push(commentsDictionary[contributor]);
    }

    aggregateData.sort(function compare(a, b){
        if(a.contributions > b.contributions){
            return -1;
        } else if(a.contributions < b.contributions){
            return 1;
        }
        return 0;
    });

    return aggregateData;
}

main();