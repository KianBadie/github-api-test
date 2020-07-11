const request = require('request-promise');
const fs = require('fs');

let allReq = [];
for(i = 0; i < 100; i++){
    allReq.push(
        request({
            method: 'GET',
            uri: 'https://api.github.com/search/repositories?q=tetres',
            json: true,
            headers: {
                'User-Agent': 'KianBadie'
            }
        }).then(function(body){
            return 'Request complete';
        }).catch(function(err){
            throw err;
        })
    );
}

(async function main(){
    await Promise.all(allReq).then(function(finishedReq){
        console.log(finishedReq);
    }).catch(function(err){
        throw err;
    });

    console.log('After Promise.all');
})();