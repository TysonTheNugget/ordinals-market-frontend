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
        displayUserOrdinals();
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
  displayUserOrdinals();
  displayListings();
}

async function displayUserOrdinals() {
  if (!connectedAddress) return;
  try {
    const response = await fetch(`${backendUrl}/ordinals/${connectedAddress}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Ordinals: ${errorText}`);
    }
    const ordinals = await response.json();
    const ordinalSelect = document.getElementById('ordinalId');
    ordinalSelect.innerHTML = '<option value="">Select an Ordinal</option>';
    ordinals.forEach(ordinal => {
      const option = document.createElement('option');
      option.value = ordinal.inscriptionId;
      option.text = `Ordinal #${ordinal.inscriptionId}`;
      ordinalSelect.appendChild(option);
    });
  } catch (error) {
    alert('Error fetching your Ordinals: ' + error.message);
  }
}

async function listOrdinal() {
  const inscriptionId = document.getElementById('ordinalId').value;
  const price = document.getElementById('price').value;
  if (!inscriptionId || !price) {
    alert('Please select an Ordinal and enter a price!');
    return;
  }

  try {
    const response = await fetch(`${backendUrl}/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inscriptionId, price, seller: connectedAddress })
    });
    if (!response.ok) {
      throw new Error('Failed to list item');
    }
    await response.json();
    displayUserOrdinals(); // Refresh dropdown
    displayListings();
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
          <p>Ordinal ID: ${listing.inscriptionId}</p>
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
      const deeplink = `unisat://request?method=sendBitcoin&to=${listing.seller}&amount=${satoshis}`;
      window.location.href = deeplink;
      setTimeout(async () => {
        await fetch(`${backendUrl}/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index, buyer: connectedAddress })
        });
        displayListings();
        alert('Check Unisat to confirm payment!');
      }, 5000);
    } else {
      if (typeof window.unisat !== 'undefined') {
        const txId = await window.unisat.sendBitcoin(listing.seller, satoshis);
        await fetch(`${backendUrl}/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index, buyer: connectedAddress })
        });
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