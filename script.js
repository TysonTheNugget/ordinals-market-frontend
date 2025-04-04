let connectedAddress = null;
const backendUrl = 'https://ordinals-market-backend.onrender.com'; // Your Render URL

async function connectWallet() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    try {
      const response = await fetch(`${backendUrl}/connect`);
      const text = await response.text();
      console.log('Raw connect response:', text);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}, Body: ${text}`);
      }
      const { deeplink, nonce } = JSON.parse(text);
      window.location.href = deeplink;
      localStorage.setItem('lastNonce', nonce); // Store nonce for manual return
      setTimeout(() => {
        alert('After signing in Unisat, return to this page manually.');
      }, 2000);
    } catch (error) {
      alert('Failed to connect: ' + error.message);
      console.error('Connection error:', error);
    }
  } else {
    if (typeof window.unisat !== 'undefined') {
      try {
        const accounts = await window.unisat.requestAccounts();
        connectedAddress = accounts[0];
        alert('Connected: ' + connectedAddress);
        document.getElementById('listForm').style.display = 'block';
        displayListings();
      } catch (error) {
        alert('Connection failed: ' + error.message);
      }
    } else {
      alert('Please install Unisat Wallet extension!');
    }
  }
}

async function checkAddress(nonce) {
  try {
    const response = await fetch(`${backendUrl}/address/${nonce}`);
    const text = await response.text();
    console.log('Raw address response:', text);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}, Body: ${text}`);
    }
    const data = JSON.parse(text);
    if (data.address) {
      connectedAddress = data.address;
      alert('Connected: ' + connectedAddress);
      document.getElementById('listForm').style.display = 'block';
      displayListings();
      localStorage.removeItem('lastNonce');
    } else {
      setTimeout(() => checkAddress(nonce), 2000);
    }
  } catch (error) {
    alert('Error checking address: ' + error.message);
    console.error('Address check error:', error);
  }
}

// Check for stored nonce on page load
const lastNonce = localStorage.getItem('lastNonce');
if (lastNonce) {
  checkAddress(lastNonce);
}

async function listOrdinal() {
  const ordinalId = document.getElementById('ordinalId').value;
  const price = document.getElementById('price').value;
  if (!ordinalId || !price) {
    alert('Please enter both Ordinal ID and price!');
    return;
  }

  const response = await fetch(`${backendUrl}/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ordinalId, price, seller: connectedAddress })
  });
  await response.json();
  displayListings();
  document.getElementById('ordinalId').value = '';
  document.getElementById('price').value = '';
}

async function displayListings() {
  const response = await fetch(`${backendUrl}/listings`);
  const listings = await response.json();
  const listingDiv = document.getElementById('listing');
  listingDiv.innerHTML = '';
  listings.forEach((listing, index) => {
    listingDiv.innerHTML += `
      <div>
        <p>Ordinal ID: ${listing.ordinalId}</p>
        <p>Price: ${listing.price} BTC</p>
        <p>Seller: ${listing.seller}</p>
        <button class="buyButton" data-index="${index}">Buy</button>
      </div>
      <hr>
    `;
  });

  document.querySelectorAll('.buyButton').forEach(button => {
    button.addEventListener('click', () => buyOrdinal(button.getAttribute('data-index')));
  });
}

async function buyOrdinal(index) {
  if (!connectedAddress) {
    alert('Please connect your wallet first!');
    return;
  }

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    const response = await fetch(`${backendUrl}/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index, buyer: connectedAddress })
    });
    const { deeplink } = await response.json();
    window.location.href = deeplink;
    setTimeout(displayListings, 5000);
  } else {
    const response = await fetch(`${backendUrl}/listings`);
    const listings = await response.json();
    const listing = listings[index];
    if (typeof window.unisat !== 'undefined') {
      try {
        const satoshis = Math.floor(listing.price * 100000000);
        const txId = await window.unisat.sendBitcoin(listing.seller, satoshis);
        await fetch(`${backendUrl}/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index, buyer: connectedAddress })
        });
        alert('Purchase successful! Transaction ID: ' + txId);
        displayListings();
      } catch (error) {
        alert('Purchase failed: ' + error.message);
      }
    } else {
      alert('Please install Unisat Wallet extension!');
    }
  }
}

document.getElementById('connectWallet').addEventListener('click', connectWallet);
document.getElementById('listButton').addEventListener('click', listOrdinal);

displayListings();