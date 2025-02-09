const WEATHER_API_KEY = 'af2c89368d6baf6de10562a19eada98d';
const OPENCAGE_API_KEY = 'a7a941ef415f41449394b8f1053881e0';
const EXCHANGE_API_KEY = '45e519aa2c47d9694ab1474f';
const FOURSQUARE_API_KEY = 'fsq3/33JO0GQe8nBYWk+vRX1qWgbxEtXXUHuqnkDhvgGWxE=';


const locationSearch = document.getElementById('locationSearch');
const searchSuggestions = document.getElementById('searchSuggestions');
const contentArea = document.getElementById('contentArea');
const tabContent = document.getElementById('tabContent');
const themeToggle = document.getElementById('themeToggle');

let selectedLocation = null;
let loadingOverlay = null;
let searchTimeout = null;
let cachedResults = new Map();


function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}


function showLoading() {
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(loadingOverlay);
  }
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}


locationSearch.addEventListener('input', handleSearch);
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => switchTab(button.dataset.tab));
});
themeToggle.addEventListener('click', toggleTheme);


async function handleSearch(e) {
  const value = e.target.value.trim();
  if (value.length < 3) {
    searchSuggestions.style.display = 'none';
    return;
  }

 
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }


  if (cachedResults.has(value)) {
    showSuggestions(cachedResults.get(value));
    return;
  }


  searchTimeout = setTimeout(async () => {
    try {
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(value)}&key=${OPENCAGE_API_KEY}&limit=5`
      );
      const data = await response.json();
      

      cachedResults.set(value, data.results);
      

      if (cachedResults.size > 50) {
        const firstKey = cachedResults.keys().next().value;
        cachedResults.delete(firstKey);
      }
      
      showSuggestions(data.results);
    } catch (error) {
      console.error('Search error:', error);
    }
  }, 300);
}

function showSuggestions(results) {
  searchSuggestions.innerHTML = '';
  searchSuggestions.style.display = 'block';

  results.forEach(result => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = result.formatted;
    div.addEventListener('click', () => selectLocation(result));
    searchSuggestions.appendChild(div);
  });
}

function selectLocation(location) {
  selectedLocation = {
    lat: location.geometry.lat,
    lng: location.geometry.lng,
    city: location.components.city || location.components.town,
    country: location.components.country
  };
  
  locationSearch.value = location.formatted;
  searchSuggestions.style.display = 'none';
  contentArea.classList.remove('hidden');
  switchTab('weather');
}

async function switchTab(tab) {
  if (!selectedLocation) return;

  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });

  showLoading();
  try {
    switch (tab) {
      case 'weather':
        await fetchWeather();
        break;
      case 'currency':
        await fetchCurrency();
        break;
      case 'attractions':
        await fetchAttractions();
        break;
    }
  } finally {
    hideLoading();
  }
}

async function fetchWeather() {
  const cacheKey = `weather-${selectedLocation.lat}-${selectedLocation.lng}`;
  const cachedData = sessionStorage.getItem(cacheKey);
  
  if (cachedData) {
    renderWeather(JSON.parse(cachedData));
    return;
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/onecall?lat=${selectedLocation.lat}&lon=${selectedLocation.lng}&exclude=minutely,hourly&units=metric&appid=${WEATHER_API_KEY}`
    );
    const data = await response.json();
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
    renderWeather(data);
  } catch (error) {
    console.error('Weather error:', error);
    showError('weather');
  }
}

async function fetchCurrency() {
  const cacheKey = 'currency-rates';
  const cachedData = sessionStorage.getItem(cacheKey);
  const cacheTime = sessionStorage.getItem('currency-cache-time');
  const now = Date.now();
  

  if (cachedData && cacheTime && (now - parseInt(cacheTime)) < 3600000) {
    renderCurrencyConverter(JSON.parse(cachedData));
    return;
  }

  try {
    const response = await fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/latest/USD`);
    const data = await response.json();
    sessionStorage.setItem(cacheKey, JSON.stringify(data.conversion_rates));
    sessionStorage.setItem('currency-cache-time', now.toString());
    renderCurrencyConverter(data.conversion_rates);
  } catch (error) {
    console.error('Currency error:', error);
    showError('currency');
  }
}

async function fetchAttractions() {
  const cacheKey = `attractions-${selectedLocation.lat}-${selectedLocation.lng}`;
  const cachedData = sessionStorage.getItem(cacheKey);
  
  if (cachedData) {
    renderAttractions(JSON.parse(cachedData));
    return;
  }

  try {
    const response = await fetch(
      `https://api.foursquare.com/v3/places/search?ll=${selectedLocation.lat},${selectedLocation.lng}&radius=5000&limit=10&categories=16000,10000,13000`,
      {
        headers: {
          'Authorization': FOURSQUARE_API_KEY,
          'Accept': 'application/json'
        }
      }
    );
    const data = await response.json();
    sessionStorage.setItem(cacheKey, JSON.stringify(data.results));
    renderAttractions(data.results);
  } catch (error) {
    console.error('Attractions error:', error);
    showError('attractions');
  }
}

function renderWeather(data) {
  const html = `
    <div class="weather-grid">
      ${data.daily.slice(0, 7).map(day => `
        <div class="weather-card">
          <div class="day">${new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' })}</div>
          <img src="http://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png" alt="${day.weather[0].description}">
          <div class="temp">${Math.round(day.temp.day)}°C</div>
          <div>${day.weather[0].main}</div>
        </div>
      `).join('')}
    </div>
  `;
  tabContent.innerHTML = html;
}

function renderAttractions(places) {
  const html = `
    <div class="attractions-grid">
      ${places.map(place => `
        <div class="attraction-card">
          <div class="attraction-content">
            <h3>${place.name}</h3>
            <p class="attraction-category">${place.categories[0]?.name || 'Tourist Attraction'}</p>
            <p class="attraction-address">${place.location.formatted_address || ''}</p>
            ${place.rating ? `
              <div class="attraction-rating">
                <span class="stars">${'★'.repeat(Math.round(place.rating / 2))}</span>
                <span class="rating-number">${place.rating / 2}/5</span>
              </div>
            ` : ''}
            ${place.distance ? `
              <p class="attraction-distance">${(place.distance / 1000).toFixed(1)} km away</p>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  tabContent.innerHTML = html;
}

function renderCurrencyConverter(rates) {
  const html = `
    <div class="currency-converter">
      <div class="currency-grid">
        <div>
          <input type="number" id="amount" class="currency-input" value="1" min="0" step="0.01">
        </div>
        <button class="swap-button" id="swapCurrencies">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8v12M17 20l4-4M17 20l-4-4"/>
          </svg>
        </button>
        <div>
          <select id="currency" class="currency-input">
            ${Object.keys(rates).sort().map(currency => `
              <option value="${currency}" ${currency === selectedLocation?.country ? 'selected' : ''}>
                ${currency}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      <div class="conversion-result" id="result"></div>
    </div>
  `;
  tabContent.innerHTML = html;

  setupCurrencyConverter(rates);
}

function setupCurrencyConverter(rates) {
  const amount = document.getElementById('amount');
  const currency = document.getElementById('currency');
  const result = document.getElementById('result');
  const swapButton = document.getElementById('swapCurrencies');

  function updateConversion() {
    const value = parseFloat(amount.value);
    const selectedCurrency = currency.value;
    const rate = rates[selectedCurrency];
    const converted = (value * rate).toFixed(2);
    result.textContent = `${value} USD = ${converted} ${selectedCurrency}`;
  }

  amount.addEventListener('input', updateConversion);
  currency.addEventListener('change', updateConversion);
  swapButton.addEventListener('click', () => {
    const currentAmount = parseFloat(amount.value);
    const currentCurrency = currency.value;
    const rate = rates[currentCurrency];
    amount.value = (currentAmount * rate).toFixed(2);
    currency.value = 'USD';
    updateConversion();
  });

  updateConversion();
}

function showError(section) {
  tabContent.innerHTML = `
    <div style="text-align: center; color: var(--text-secondary); padding: 2rem;">
      Sorry, we couldn't load the ${section} information. Please try again later.
    </div>
  `;
}

// Initialize the app
initTheme();
tabContent.innerHTML = `
  <div style="text-align: center; color: var(--text-secondary); padding: 2rem;">
    <h2 style="margin-bottom: 1rem;">Welcome to Travel Planner</h2>
    <p>Start by searching for a destination above</p>
  </div>
`;