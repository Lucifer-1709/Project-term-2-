// app.js
const WEATHER_API_KEY = 'af2c89368d6baf6de10562a19eada98d';
const OPENCAGE_API_KEY = 'a7a941ef415f41449394b8f1053881e0';
const EXCHANGE_API_KEY = '45e519aa2c47d9694ab1474f';
const FOURSQUARE_API_KEY = 'fsq36jol1SvMCRdHUCp1taPZPgFuWrm/dwQiWu3s5TcKap0=';

// DOM Elements
const locationSearch = document.getElementById('locationSearch');
const searchSuggestions = document.getElementById('searchSuggestions');
const contentArea = document.getElementById('contentArea');
const tabContent = document.getElementById('tabContent');
const themeToggle = document.getElementById('themeToggle');
const locationName = document.getElementById('locationName');
const locationDetails = document.getElementById('locationDetails');
const toastNotification = document.getElementById('toastNotification');

// State management
let selectedLocation = null;
let loadingOverlay = null;
let searchTimeout = null;
let cachedResults = new Map();

// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const sunIcon = themeToggle.querySelector('.fa-sun');
  const moonIcon = themeToggle.querySelector('.fa-moon');
  if (theme === 'dark') {
    sunIcon.style.display = 'inline-block';
    moonIcon.style.display = 'none';
  } else {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'inline-block';
  }
}

// Loading state management
function showLoading() {
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="loading-spinner-container">
        <div class="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    `;
    document.body.appendChild(loadingOverlay);
  }
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

// Notification management
function showToast(message, type = 'info') {
  toastNotification.textContent = message;
  toastNotification.className = `toast-notification ${type}`;
  toastNotification.style.opacity = '1';
  setTimeout(() => {
    toastNotification.style.opacity = '0';
  }, 3000);
}

// Event listeners
locationSearch.addEventListener('input', handleSearch);
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => switchTab(button.dataset.tab));
});
themeToggle.addEventListener('click', toggleTheme);

// Search functionality
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
      showLoading();
      const response = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(value)}&key=${OPENCAGE_API_KEY}&limit=5`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch location data');
      }
      
      const data = await response.json();
      
      if (data.results.length === 0) {
        showToast('No locations found. Please try a different search.', 'warning');
        return;
      }

      cachedResults.set(value, data.results);

      if (cachedResults.size > 50) {
        const firstKey = cachedResults.keys().next().value;
        cachedResults.delete(firstKey);
      }
      
      showSuggestions(data.results);
    } catch (error) {
      console.error('Search error:', error);
      showToast('Failed to fetch location data. Please try again.', 'error');
    } finally {
      hideLoading();
    }
  }, 300);
}

function showSuggestions(results) {
  searchSuggestions.innerHTML = '';
  searchSuggestions.style.display = 'block';

  results.forEach(result => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.innerHTML = `
      <div class="suggestion-name">${result.formatted}</div>
      <div class="suggestion-details">${result.components.country}</div>
    `;
    div.addEventListener('click', () => selectLocation(result));
    searchSuggestions.appendChild(div);
  });

  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchSuggestions.contains(e.target) && e.target !== locationSearch) {
      searchSuggestions.style.display = 'none';
    }
  });
}

function selectLocation(location) {
  selectedLocation = {
    lat: location.geometry.lat,
    lng: location.geometry.lng,
    city: location.components.city || location.components.town || location.components.village,
    country: location.components.country,
    formatted: location.formatted,
    timezone: location.annotations?.timezone?.name || 'UTC'
  };
  
  locationSearch.value = location.formatted;
  searchSuggestions.style.display = 'none';
  contentArea.classList.remove('hidden');
  locationName.textContent = selectedLocation.city || selectedLocation.country;
  locationDetails.textContent = selectedLocation.formatted;
  switchTab('weather');
}

// Tab management
async function switchTab(tab) {
  if (!selectedLocation) {
    showToast('Please select a location first.', 'warning');
    return;
  }

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
      case 'localTime':
        await renderLocalTime();
        break;
    }
  } catch (error) {
    console.error(`Error fetching ${tab} data:`, error);
    showToast(`Failed to fetch ${tab} data. Please try again.`, 'error');
    showError(tab);
  } finally {
    hideLoading();
  }
}

// Weather functionality
async function fetchWeather() {
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${selectedLocation.lat}&lon=${selectedLocation.lng}&units=metric&appid=${WEATHER_API_KEY}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }
  
  const data = await response.json();
  renderWeather(data);
}

function renderWeather(data) {
  const dailyForecasts = data.list.reduce((acc, forecast) => {
    const date = new Date(forecast.dt * 1000).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = forecast;
    }
    return acc;
  }, {});

  const html = `
    <div class="weather-container">
      <div class="weather-grid">
        ${Object.values(dailyForecasts).slice(0, 5).map(day => `
          <div class="weather-card">
            <div class="weather-date">
              ${new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <img 
              src="https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png" 
              alt="${day.weather[0].description}"
              class="weather-icon"
            >
            <div class="weather-temp">
              <span class="temp-max">${Math.round(day.main.temp_max)}°C</span>
              <span class="temp-min">${Math.round(day.main.temp_min)}°C</span>
            </div>
            <div class="weather-desc">${day.weather[0].description}</div>
            <div class="weather-details">
              <div>Humidity: ${day.main.humidity}%</div>
              <div>Wind: ${Math.round(day.wind.speed * 3.6)} km/h</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  tabContent.innerHTML = html;
}

// Currency functionality
async function fetchCurrency() {
  const response = await fetch(
    `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/latest/USD`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch currency data');
  }
  
  const data = await response.json();
  renderCurrencyConverter(data.conversion_rates);
}

function renderCurrencyConverter(rates) {
  const html = `
    <div class="currency-converter">
      <div class="converter-container">
        <div class="currency-input-group">
          <label for="fromAmount">Amount</label>
          <input type="number" id="fromAmount" class="currency-input" value="1" min="0" step="0.01">
        </div>
        
        <div class="currency-input-group">
          <label for="fromCurrency">From</label>
          <select id="fromCurrency" class="currency-select">
            ${Object.keys(rates).sort().map(currency => `
              <option value="${currency}" ${currency === 'USD' ? 'selected' : ''}>
                ${currency}
              </option>
            `).join('')}
          </select>
        </div>

        <button id="swapCurrencies" class="swap-button" aria-label="Swap currencies">
          <i class="fas fa-exchange-alt"></i>
        </button>

        <div class="currency-input-group">
          <label for="toCurrency">To</label>
          <select id="toCurrency" class="currency-select">
            ${Object.keys(rates).sort().map(currency => `
              <option value="${currency}" ${currency === (selectedLocation?.country || 'EUR') ? 'selected' : ''}>
                ${currency}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      
      <div id="conversionResult" class="conversion-result"></div>
    </div>
  `;
  tabContent.innerHTML = html;

  setupCurrencyConverter(rates);
}

function setupCurrencyConverter(rates) {
  const fromAmount = document.getElementById('fromAmount');
  const fromCurrency = document.getElementById('fromCurrency');
  const toCurrency = document.getElementById('toCurrency');
  const swapButton = document.getElementById('swapCurrencies');
  const result = document.getElementById('conversionResult');

  function updateConversion() {
    const amount = parseFloat(fromAmount.value);
    if (isNaN(amount)) {
      result.textContent = 'Please enter a valid amount';
      return;
    }

    const from = fromCurrency.value;
    const to = toCurrency.value;
    const rate = rates[to] / rates[from];
    const converted = (amount * rate).toFixed(2);
    
    result.innerHTML = `
      <div class="conversion-amount">${amount} ${from} = ${converted} ${to}</div>
      <div class="conversion-rate">1 ${from} = ${rate.toFixed(4)} ${to}</div>
    `;
  }

  fromAmount.addEventListener('input', updateConversion);
  fromCurrency.addEventListener('change', updateConversion);
  toCurrency.addEventListener('change', updateConversion);
  
  swapButton.addEventListener('click', () => {
    const tempCurrency = fromCurrency.value;
    fromCurrency.value = toCurrency.value;
    toCurrency.value = tempCurrency;
    updateConversion();
  });

  updateConversion();
}

// Attractions functionality
async function fetchAttractions() {
  const categories = '16000,10000,13000,12000,16032,16034,16036';
  const response = await fetch(
    `https://api.foursquare.com/v3/places/search?ll=${selectedLocation.lat},${selectedLocation.lng}&radius=5000&limit=12&categories=${categories}&sort=RATING`,
    {
      headers: {
        'Authorization': FOURSQUARE_API_KEY,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch attractions data');
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error('No attractions found in this area');
  }

  renderAttractions(data.results);
}
// Continuation of app.js

function renderAttractions(places) {
  const html = `
    <div class="attractions-container">
      <div class="attractions-grid">
        ${places.map(place => `
          <div class="attraction-card">
            <div class="attraction-content">
              <h3 class="attraction-title">${place.name}</h3>
              <div class="attraction-category">
                <i class="fas ${getCategoryIcon(place.categories[0]?.id)}"></i>
                ${place.categories[0]?.name || 'Tourist Attraction'}
              </div>
              ${place.location.formatted_address ? `
                <p class="attraction-address">
                  <i class="fas fa-map-marker-alt"></i>
                  ${place.location.formatted_address}
                </p>
              ` : ''}
              ${place.rating ? `
                <div class="attraction-rating">
                  <div class="stars">
                    ${generateStars(place.rating)}
                  </div>
                  <span class="rating-number">${(place.rating / 2).toFixed(1)}/5</span>
                </div>
              ` : ''}
              ${place.distance ? `
                <p class="attraction-distance">
                  <i class="fas fa-walking"></i>
                  ${(place.distance / 1000).toFixed(1)} km away
                </p>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  tabContent.innerHTML = html;
}

function getCategoryIcon(categoryId) {
  const categoryIcons = {
    '16000': 'fa-landmark',
    '10000': 'fa-store',
    '13000': 'fa-utensils',
    '12000': 'fa-camera',
    '16032': 'fa-university',
    '16034': 'fa-church',
    '16036': 'fa-monument'
  };
  return categoryIcons[categoryId] || 'fa-map-marker-alt';
}

function generateStars(rating) {
  const normalizedRating = rating / 2; // Convert to 5-star scale
  const fullStars = Math.floor(normalizedRating);
  const hasHalfStar = normalizedRating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return `
    ${'<i class="fas fa-star"></i>'.repeat(fullStars)}
    ${hasHalfStar ? '<i class="fas fa-star-half-alt"></i>' : ''}
    ${'<i class="far fa-star"></i>'.repeat(emptyStars)}
  `;
}

// Local Time functionality
async function renderLocalTime() {
  const html = `
    <div class="local-time-container">
      <div class="time-card">
        <div class="time-icon">
          <i class="fas fa-clock"></i>
        </div>
        <div class="time-details">
          <h3>Current Local Time in</h3>
          <h2>${selectedLocation.city || selectedLocation.country}</h2>
          <div id="currentTime" class="current-time"></div>
          <div id="timeZone" class="time-zone">${selectedLocation.timezone}</div>
        </div>
      </div>
      <div class="time-comparison">
        <div class="your-time">
          <h4>Your Time</h4>
          <div id="yourTime"></div>
        </div>
        <div class="time-difference">
          <h4>Time Difference</h4>
          <div id="timeDifference"></div>
        </div>
      </div>
    </div>
  `;
  tabContent.innerHTML = html;

  updateTime();
  const timeInterval = setInterval(updateTime, 1000);

  // Cleanup interval when switching tabs
  tabContent.setAttribute('data-interval', timeInterval);
}

function updateTime() {
  const currentTime = document.getElementById('currentTime');
  const yourTime = document.getElementById('yourTime');
  const timeDifference = document.getElementById('timeDifference');
  
  if (!currentTime || !yourTime || !timeDifference) {
    return;
  }

  const now = new Date();
  const options = {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true
  };

  // Local time at selected location
  const locationTime = new Date(now.toLocaleString('en-US', { timeZone: selectedLocation.timezone }));
  currentTime.textContent = locationTime.toLocaleString('en-US', options);

  // User's local time
  yourTime.textContent = now.toLocaleString('en-US', options);

  // Calculate time difference
  const diffHours = Math.round((locationTime - now) / (1000 * 60 * 60));
  const absDiff = Math.abs(diffHours);
  timeDifference.textContent = diffHours === 0 ? 
    'Same time zone' : 
    `${absDiff} hour${absDiff !== 1 ? 's' : ''} ${diffHours > 0 ? 'ahead' : 'behind'}`;
}

function showError(section) {
  tabContent.innerHTML = `
    <div class="error-container">
      <div class="error-content">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Oops! Something went wrong</h3>
        <p>We couldn't load the ${section} information at this time.</p>
        <button onclick="switchTab('${section}')" class="retry-button">
          <i class="fas fa-redo"></i> Try Again
        </button>
      </div>
    </div>
  `;
}

// Initialize the app
initTheme();
tabContent.innerHTML = `
  <div class="welcome-container">
    <div class="welcome-content">
      <i class="fas fa-globe-americas welcome-icon"></i>
      <h2>Welcome to Travel Planner Pro</h2>
      <p>Start your journey by searching for a destination above</p>
      <ul class="feature-list">
        <li><i class="fas fa-cloud-sun"></i> Get weather forecasts</li>
        <li><i class="fas fa-money-bill-wave"></i> Convert currencies</li>
        <li><i class="fas fa-landmark"></i> Discover attractions</li>
        <li><i class="fas fa-clock"></i> Check local time</li>
      </ul>
    </div>
  </div>
`;

// Clean up intervals when switching tabs
function cleanupIntervals() {
  const currentInterval = tabContent.getAttribute('data-interval');
  if (currentInterval) {
    clearInterval(parseInt(currentInterval));
    tabContent.removeAttribute('data-interval');
  }
}

// Updated CSS styles
const additionalStyles = `
  .welcome-container {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-secondary);
  }

  .welcome-content {
    max-width: 600px;
    margin: 0 auto;
  }

  .welcome-icon {
    font-size: 4rem;
    color: var(--primary-color);
    margin-bottom: 1.5rem;
  }

  .feature-list {
    list-style: none;
    padding: 0;
    margin-top: 2rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .feature-list li {
    padding: 1rem;
    background: var(--gray-100);
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .error-container {
    text-align: center;
    padding: 3rem 1rem;
  }

  .error-content {
    max-width: 400px;
    margin: 0 auto;
  }

  .error-content i {
    font-size: 3rem;
    color: var(--accent-color);
    margin-bottom: 1rem;
  }

  .retry-button {
    margin-top: 1.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .retry-button:hover {
    background: var(--primary-hover);
  }

  .local-time-container {
    max-width: 600px;
    margin: 0 auto;
  }

  .time-card {
    background: var(--gray-100);
    border-radius: 1rem;
    padding: 2rem;
    text-align: center;
    margin-bottom: 2rem;
  }

  .time-icon {
    font-size: 3rem;
    color: var(--primary-color);
    margin-bottom: 1rem;
  }

  .current-time {
    font-size: 3rem;
    font-weight: bold;
    margin: 1rem 0;
  }

  .time-zone {
    color: var(--text-secondary);
  }

  .time-comparison {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    text-align: center;
  }

  .your-time, .time-difference {
    background: var(--gray-100);
    border-radius: 0.5rem;
    padding: 1rem;
  }

  @media (max-width: 640px) {
    .time-comparison {
      grid-template-columns: 1fr;
    }
  }
`;

// Add the additional styles to the existing stylesheet
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);
