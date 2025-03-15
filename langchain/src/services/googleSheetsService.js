// ------------------------------------------------------------
// GOOGLE SHEETS SERVICE
// ------------------------------------------------------------

import { SPREADSHEET_ID, RANGE, API_KEY } from '../config/constants';
import { fetchData, fetchWithCORS } from './corsService';
import { setTempData } from './dataService';
import { showCORSLink, hideCORSLink } from '../utils/uiHelpers';

/**
 * Fetches data from Google Sheets API
 */
export function getGoogleSheetData() {
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

/**
 * Populates dropdown with feed options
 * @param {Array} feedData Array of feed data from Google Sheets
 */
export function populateDropdown(feedData) {
  const selectElement = document.getElementById('apiFeeds');
  selectElement.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = "none";
  defaultOption.textContent = "Select a feed.......";
  selectElement.appendChild(defaultOption);

  feedData.forEach(feed => {
    const option = document.createElement('option');
    option.value = feed[0]; // Feed name
    option.textContent = feed[1];
    selectElement.appendChild(option);
  });

  // Restore last selected feed from localStorage
  const savedFeed = localStorage.getItem('selectedFeed');
  if (savedFeed) {
    selectElement.value = savedFeed;
    updateFeed(savedFeed);  // Automatically load previously selected feed
  }
}

/**
 * Fetches feed details from Google Sheets
 * @param {string} feedValue Feed name to fetch details for
 * @returns {Promise<Object>} Promise resolving to feed details
 */
export function fetchFeedDetails(feedValue) {
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

/**
 * Updates feed based on selection
 * @param {string} feedValue Selected feed value
 */
export function updateFeed(feedValue) {
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
        showCORSLink();
        fetchWithCORS(url);
      } else {
        console.log('No CORS Needed');
        hideCORSLink();
        fetchData(url);
      }
    }
  }).catch(error => {
    console.error('Error fetching feed details:', error);
  });
}

/**
 * Displays data in the UI
 * @param {Object} data Data to display
 */
export function displayData(data) {
  const resultJson = document.getElementById('resultJson');
  resultJson.innerHTML = JSON.stringify(data, null, 2);
  setTempData(data);
}