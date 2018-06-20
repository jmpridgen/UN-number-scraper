const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');

axios.get('https://en.wikipedia.org/wiki/Lists_of_UN_numbers')
  .then((response) => {
    const $ = cheerio.load(response.data);
    const linkData = $('#mw-content-text');
    const linkElements = linkData.find('li a');
    const filteredLinkElements = linkElements.not((index, element) => {
      if ($(element).parent().parent().parent().attr('id') === 'toc') {
        return true;
      } else {
        return false;
      }
    });
    const filteredHrefs = []
    filteredLinkElements.each((i, el) => {
      const href = $(el).attr('href')
      filteredHrefs.push(href);
    });
    const UnNumberHrefs = filteredHrefs.filter(elem => elem.includes('List_of_UN'));
    const baseURL = 'https://en.wikipedia.org';

    const axiosPromises = UnNumberHrefs.map(elem => axios.get(`${baseURL}${elem}`));

    return Promise.all(axiosPromises);
  }).then(axiosResponses => {
    const responseData = axiosResponses.reduce((previousResponses, response) => {
      const $ = cheerio.load(response.data);
      const tableElement = $('#mw-content-text').first('table');
      const tableRows = tableElement.find('tr')
      tableRows.each((i,el) => {
        const name = $(el).find('td')
        const UNClass = name.next()
        const description = UNClass.next();

        previousResponses.push({
          name: name.html(),
          UNClass: UNClass.html(),
          description: description.text()
        });
      });
      return previousResponses;

    }, []);
    const mappedResponses = [];
    responseData.forEach((response) => {
      const numberRegex = /\d\d\d\d/g;
      if (response.name) {
        const matches = response.name.match(numberRegex);
        if (matches) {
          if (matches.length === 2) {
            // got more than one response need to fill in all in between
            for (let i = Number(matches[0]); i < Number(matches[1]); i += 1) {
              const newEntry = Object.assign({}, response, { id: ('0000' + i.toString()).slice(-4) })
              mappedResponses.push(newEntry);
            }
          } else if (matches.length === 1) {
            // only got one response number so just make one entry
            const newEntry = Object.assign({}, response, { id: matches[0] })
            mappedResponses.push(newEntry);
          }
        }
      } else {
        console.log('got a null name');
      }
    });

    console.log(mappedResponses);
    fs.writeFileSync('./UN-Numbers.json', JSON.stringify(mappedResponses), 'utf-8');
    console.log('DONE!');

    // console.log(responseData);
  }).catch(err => console.error('got an error:', err));
