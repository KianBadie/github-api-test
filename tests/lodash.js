const _ = require('lodash');

let person1 = {
    firstName: 'Kian',
    lastName: 'Badie',
    age: 23
};

let person2 = {
    firstName: 'Joe',
    lastName: 'Blow',
    age: -1
};

let person3 = {
    firstName: 'Kian',
    lastName: 'Badie',
    age: 23    
}

console.log(`person1 == person2: ${_.isEqual(person1, person2)}`);
console.log(`person1 == person3: ${_.isEqual(person1, person3)}`);
console.log(`person2 == person3: ${_.isEqual(person2, person3)}`);