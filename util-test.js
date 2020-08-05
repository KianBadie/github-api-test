const environment = require('dotenv').config();
const GitHubUtil = require('./github-util');

let tester = new GitHubUtil(process.env.token);
// https://api.github.com/search/repositories?q=topic:hack-for-la&sort=updated&order=desc
tester.getRepoByIdSync(79977929)
    .then(function(data){
        console.log(data);
    }); 