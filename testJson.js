import fs from 'fs'

fs.readFile('comandi.json', function(err, data) { 

    if (err) throw err; 

    const comandi = JSON.parse(data); 
    console.log(comandi); 
}); 