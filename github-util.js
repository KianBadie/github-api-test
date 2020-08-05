const axios = require('axios');
const _ = require('lodash');

class GitHubUtil {

    /**
     * Constructs a GitHubUtil object with a given api token.
     * @param  {String} apiToken        [Api token of given GitHub API app]
     */
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
        requestUrl = !(_.isEmpty(parameters)) ? `${requestUrl}?`: requestUrl;
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
                return res.data.concat(await this.fetchAllSync(link));
            }
        }
        return res.data;
    }

    /**
     * Method to make search repositories with given keywords, qualifiers, and parameters
     * @param  {Array} searchKeywords   [Keywords to include in request]
     * @param  {Array} qualifiers       [Dictionary of qualifiers to be conducted in search]
     * @param  {Object} parameters      [Dictionary of parameters to be included in API request]
     * @return {Object}                 [Object of {total_count, incomplete_results, items} where items is the data being requested]
     */
    async searchRepositoriesSync({ searchKeywords=[], qualifiers={}, parameters={} } = {}){
        let endpoint = 'https://api.github.com/search/repositories';
        // Construct query parameter for request url
        let q = '';
        for(let keyword of searchKeywords){
            q = q.concat(`${keyword}+`);
        }
        for(let qualifier in qualifiers){
            q = q.concat(`${qualifier}:${qualifiers[qualifier]}+`);
        }
        // Add query parameter to parameters object after creating a deep copy of it
        let parametersCopy = _.clone(parameters);
        parametersCopy.q = q;
        return await this.fetchAllSync(endpoint, parametersCopy);
    }

    /**
     * Method to fetch a repository by its id
     * @param  {Integer} repoId         [The integer id of the repository]
     * @return {Object}                 [Data object representing repository with id repoId]
     */
    async getRepoByIdSync(repoId) {
        let endpoint = `https://api.github.com/repositories/${repoId}`;
        return await this.fetchAllSync(endpoint);
    }
}

module.exports = GitHubUtil;