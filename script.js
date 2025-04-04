let connectedAddress = null;
const backendUrl = 'https://ordinals-market-backend.onrender.com';

async function connectWallet() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    try {
      const response = await fetch(`${backendUrl}/connect`);
      if (!response.ok) {
        throw new Error('Failed to fetch deeplink');
      }
      const { deeplink } = await response.json();
      window.location.href = deeplink;
      document.getElementById('manualConnect').style.display = 'block';
      alert('Sign in Unisat, then paste your address here.');
    } catch (error) {
      alert('Failed to connect: ' + error.message);
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

function submitAddress() {
  const address = document.getElementById('manualAddress').value;
  if (!address) {
    alert('Please paste your address!');
    return;
  }
  connectedAddress = address;
  alert('Connected: ' + connectedAddress);
  document.getElementById('manualConnect').style.display = 'none';
  document.getElementById('listForm').style.display = 'block';
  displayListings();
}

async function listOrdinal() {
  const ordinalId = document.getElementById('ordinalId').value;
  const price = document.getElementById('price').value;
  if (!ordinalId || !price) {
    alert('Please enter both Ordinal ID and price!');
    return;
  }

  try {
    const response = await fetch(`${backendUrl}/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordinalId, price, seller: connectedAddress })
    });
    if (!response.ok) {
      throw new Error('Failed to list item');
    }
    await response.json();
    displayListings();
    document.getElementById('ordinalId').value = '';
    document.getElementById('price').value = '';
  } catch (error) {
    alert('Error listing item: ' + error.message);
  }
}

async function displayListings() {
  try {
    const response = await fetch(`${backendUrl}/listings`);
    if (!response.ok) {
      throw new Error('Failed to fetch listings');
    }
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
  } catch (error) {
    alert('Error displaying listings: ' + error.message);
  }
}

async function buyOrdinal(index) {
  if (!connectedAddress) {
    alert('Please connect your wallet first!');
    return;
  }

  try {
    const response = await fetch(`${backendUrl}/listings`);
    if (!response.ok) {
      throw new Error('Failed to fetch listings');
    }
    const listings = await response.json();
    const listing = listings[index];
    if (!listing) {
      alert('Item not found!');
      return;
    }

    const satoshis = Math.floor(listing.price * 100000000);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // Use deeplink for mobile, like local setup
      const deeplink = `unisat://request?method=sendBitcoin&to=${listing.seller}&amount=${satoshis}`;
      window.location.href = deeplink;
      // After payment, assume success and update backend
      setTimeout(async () => {
        const buyResponse = await fetch(`${backendUrl}/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index, buyer: connectedAddress })
        });
        if (!buyResponse.ok) {
          throw new Error('Failed to complete buy');
        }
        displayListings();
        alert('Check Unisat to confirm payment!');
      }, 5000);
    } else {
      if (typeof window.unisat !== 'undefined') {
        const txId = await window.unisat.sendBitcoin(listing.seller, satoshis);
        const buyResponse = await fetch(`${backendUrl}/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index, buyer: connectedAddress })
        });
        if (!buyResponse.ok) {
          throw new Error('Failed to complete buy');
        }
        alert('Purchase successful! Transaction ID: ' + txId);
        displayListings();
      } else {
        alert('Please install Unisat Wallet extension!');
      }
    }
  } catch (error) {
    alert('Error buying item: ' + error.message);
  }
}

document.getElementById('connectWallet').addEventListener('click', connectWallet);
document.getElementById('submitAddress').addEventListener('click', submitAddress);
document.getElementById('listButton').addEventListener('click', listOrdinal);

displayListings();