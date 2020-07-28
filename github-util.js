const axios = require('axios');

class GitHubUtil {

    constructor(apiToken){
        this.config = {
            headers: {
                Authorization: `token ${apiToken}`
            }
        }
    }

    async getIssueCommentsSync(issueCommentsUrl, parameters){
        // Construct request url with given parameters
        let requestUrl = parameters ? `${issueCommentsUrl}?`: issueCommentsUrl;
        for(let parameter in parameters){
            requestUrl = requestUrl.concat(`${parameter}=${parameters[parameter]}&`);
        }
        let issueCommentsRes = await axios.get(requestUrl, this.config);
        // Return results immediataly if there is only 1 page of results.
        if(!issueCommentsRes.headers.link){
            return Promise.resolve(issueCommentsRes.data);
        }
        // Get page relation links from header of response and make request for next page of comments
        let linkRelations = issueCommentsRes.headers.link.split(',').map(function(item) {
            return item.trim();
        });
        for(let linkRel of linkRelations){
            let [link, rel] = linkRel.split(';').map(function(item) {
                return item.trim();
            });
            link = link.substring(1, link.length - 1);
            if(rel == 'rel="next"'){
                // Make recursive call to same method to get next page of comments
                return issueCommentsRes.data.concat(await this.getIssueCommentsSync(link));
            }
        }
        return issueCommentsRes.data;
    }
}

module.exports = GitHubUtil;