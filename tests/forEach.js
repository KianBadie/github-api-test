let mylist = [];
for(i = 0; i < 100; i++){
    mylist.push(i);
}


console.log('Square of all the even numbers');
mylist.forEach(function(element){
    if(element % 2 != 0) return;
    console.log(`${element}^2 = ${element*element}`);
})