const environment = require('dotenv').config();
const GitHubUtil = require('./github-util');

let tester = new GitHubUtil(process.env.token);
tester.searchRepositories({
    qualifiers: [{topic: 'hack-for-la'}]
}).then(function(data){
    console.log(data.items.length);
});