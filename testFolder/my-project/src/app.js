import { OpenAIEmbeddings } from "@langchain/openai";
const SPREADSHEET_ID = '1jQTlXWom-pXvyP9zuTcbdluyvpb43hu2h7anxhF5qlQ';  // Google Sheets ID
const RANGE = 'A2:J';  // Data range
const API_KEY = 'AIzaSyC211F_ub1nAGr2Xv-wJGeulMg4nPzG1yE';  // API key

// Get Google Sheets data
function getGoogleSheetData() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
            populateDropdown(data.values);
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Populate dropdown menu
function populateDropdown(feedData) {
    const selectElement = document.getElementById('apiFeeds');
    selectElement.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = "none";
    defaultOption.textContent = "Select a feed.......";
    selectElement.appendChild(defaultOption);

    feedData.forEach(feed => {
        const option = document.createElement('option');
        option.value = feed[0]; // Feed name
        option.textContent = feed[0];
        selectElement.appendChild(option);
    });

    // Restore last selected feed from localStorage
    const savedFeed = localStorage.getItem('selectedFeed');
    if (savedFeed) {
        selectElement.value = savedFeed;
        updateFeed(savedFeed);  // Automatically load previously selected feed
    }
}

// Update feed
function fetchWithCORS(url) {
    console.log('Making CORS request to:', url);  // Print requested URL
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';  // Use CORS proxy

    fetch(proxyUrl + url)
        .then(response => {
            console.log('CORS Response Status:', response.status);  // Print HTTP status
            return response.text();  // Use text() to get response content (for RSS)
        })
        .then(data => {
            console.log('CORS Response Data:', data);  // Print returned data

            // Check if it is RSS format (XML)
            if (data.startsWith("<?xml")) {
                console.log("Received XML data, parsing...");
                parseRSS(data);  // Call the parsing function for XML
            } else {
                try {
                    const jsonData = JSON.parse(data);  // If it is JSON data
                    displayData(jsonData);  // Display JSON data
                } catch (error) {
                    console.error("Error parsing JSON:", error);  // Error parsing JSON
                }
            }
        })
        .catch(error => {
            console.error('CORS request failed:', error);  // Print request error
        });
}

// Parse RSS (XML) data
function parseRSS(xmlData) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, "text/xml");

    // Get all RSS items
    const items = xmlDoc.getElementsByTagName("item");
    const formattedItems = [];
    
    // Iterate through each item
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const link = item.querySelector("link") ? item.querySelector("link").textContent : "No link";
        const description = item.querySelector("description") ? item.querySelector("description").textContent : "No description";
        const pubDate = item.querySelector("pubDate") ? item.querySelector("pubDate").textContent : "No date";
        const guid = item.querySelector("guid") ? item.querySelector("guid").textContent : "No GUID";

        formattedItems.push({
            link,
            description,
            pubDate,
            guid
        });
    }

    // Print parsed items
    console.log("Parsed RSS Items:", formattedItems);
    displayData(formattedItems);  // Display RSS data
}

// Display data (either RSS or JSON)
function displayData(data) {
    const resultJson = document.getElementById('resultJson');
    resultJson.innerHTML = JSON.stringify(data, null, 2);  // Display JSON data
}

// Update feed
function updateFeed(feedValue) {
    console.log(`Selected feed: ${feedValue}`);

    // Clear previous data
    document.getElementById('resultJson').innerHTML = '';
    document.getElementById('resultFull').innerHTML = '';

    localStorage.setItem('selectedFeed', feedValue);  // Save current selection

    fetchFeedDetails(feedValue).then(feedDetails => {
        if (feedDetails) {
            const { url, cors } = feedDetails;
            console.log(`Feed URL: ${url}, CORS Needed: ${cors}`);
            if (cors === "TRUE") {
                console.log('CORS Needed');
                showCORSLink();  // Show CORS alert
                fetchWithCORS(url);  // Perform CORS request and print detailed information
            } else {
                console.log('No CORS Needed');
                hideCORSLink();  // Hide CORS alert
                fetchData(url);  // Directly fetch data
            }
        }
    }).catch(error => {
        console.error('Error fetching feed details:', error);
    });
}


// Hide CORS alert
function hideCORSLink() {
    document.getElementById('corsLink').style.display = 'none';  // Hide CORS alert
}

// Fetch feed details
function fetchFeedDetails(feedValue) {
    return new Promise((resolve, reject) => {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                const feedRow = data.values.find(row => row[0] === feedValue);
                if (feedRow) {
                    resolve({
                        url: feedRow[9],  // Feed URL
                        cors: feedRow[8]  // CORS requirement
                    });
                } else {
                    reject('Feed not found');
                }
            })
            .catch(error => reject(error));
    });
}

// Show CORS alert
function showCORSLink() {
    document.getElementById('corsLink').style.display = 'block';  // Show CORS alert
}

// Request data (no CORS)
function fetchData(url) {
    console.log('CORS not needed URL:', url);
    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log('Fetched data:', data);
            displayData(data);  // Display data
        })
        .catch(error => {
            console.error('Data fetch failed:', error);
        });
}


// Call the function to fetch Google Sheet data when the page is loaded
document.addEventListener('DOMContentLoaded', function() {
    getGoogleSheetData();  // Fetch data from Google Sheet
});

// Listen for CORS refresh button click event
document.addEventListener('click', function(event) {
    if (event.target.id === 'corsLink' && event.target.tagName === 'A') {
        alert("CORS passthrough enabled. Please refresh the page.");
    }
});