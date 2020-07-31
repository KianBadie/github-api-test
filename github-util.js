const axios = require('axios');
const _ = require('lodash');

class GitHubUtil {

    constructor(apiToken){
        this.config = {
            headers: {
                Authorization: `token ${apiToken}`
            }
        }
    }

    /**
     * Method to make request with pagination with given request url and parameters
     * @param  {String} requestUrl      [GitHub API endpoint to request]
     * @param  {Object} parameters      [Dictionary of parameters to be included in API request]
     * @return {Array}                  [Array of data objects relevant to requestUrl]
     */
    async fetchAllSync(requestUrl, parameters={}) {
        // Construct request url with given parameters
        requestUrl = parameters ? `${requestUrl}?`: requestUrl;
        for(let parameter in parameters){
            requestUrl = requestUrl.concat(`${parameter}=${parameters[parameter]}&`);
        }
        let res = await axios.get(requestUrl, this.config);
        // Return results immediataly if there is only 1 page of results.
        if(!res.headers.link){
            return Promise.resolve(res.data);
        }
        // Get page relation links from header of response and make request for next page of comments
        let linkRelations = res.headers.link.split(',').map(function(item) {
            return item.trim();
        });
        for(let linkRel of linkRelations){
            let [link, rel] = linkRel.split(';').map(function(item) {
                return item.trim();
            });
            link = link.substring(1, link.length - 1);
            if(rel == 'rel="next"'){
                // Make recursive call to same method to get next page of comments
                return res.data.concat(await this.getIssueCommentsSync(link));
            }
        }
        return res.data;
    }

    /**
     * Method to make search repositories with given keywords, qualifiers, and parameters
     * @param  {Array} searchKeywords   [Keywords to include in request]
     * @param  {Array} qualifiers       [Array of qualifiers objects of type {qualifier: value}]
     * @param  {Object} parameters      [Dictionary of parameters to be included in API request]
     * @return {Object}                 [Object of {total_count, incomplete_results, items} where items is the data being requested]
     */
    async searchRepositories({ searchKeywords=[], qualifiers=[], parameters={} } = {}){
        let endpoint = 'https://api.github.com/search/repositories';
        // Construct query parameter for request url
        let q = '';
        for(let keyword of searchKeywords){
            q = q.concat(`${keyword}+`);
        }
        for(let qualifier of qualifiers){
            let [ qualifierName ] = Object.keys(qualifier);
            q = q.concat(`${qualifierName}:${qualifier[qualifierName]}+`);
        }
        // Add query parameter to parameters object after creating a deep copy of it
        let parametersCopy = _.clone(parameters);
        parametersCopy.q = q;
        return await this.fetchAllSync(endpoint, parametersCopy);
    }
}

module.exports = GitHubUtil;