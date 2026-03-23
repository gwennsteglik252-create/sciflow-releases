import fetch from "node-fetch";

const query = "metal-air battery bifunctional catalyst ORR OER";
const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=type:article&sort=relevance_score:desc&per_page=8`;
console.log("URL:", url);

fetch(url)
  .then(res => res.json())
  .then(data => {
    console.log("Results count:", data.results?.length);
    if(data.results) {
      console.dir(data.results[0].title);
    }
  })
  .catch(err => console.error("Error:", err));
