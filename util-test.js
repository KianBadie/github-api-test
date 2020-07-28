const environment = require('dotenv').config();
const GitHubUtil = require('./github-util');

let tester = new GitHubUtil(process.env.token);
tester.getIssueCommentsSync('https://api.github.com/repos/hackforla/website/issues/comments', {per_page:100,since:'2020-07-27T11:01:05.000Z'})
    .then(function(data){
        console.log(data.length);
    });