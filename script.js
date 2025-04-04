let connectedAddress = null;
const backendUrl = 'https://ordinals-market-backend.onrender.com';
const appUrl = 'https://ordinals-market-frontend.vercel.app';
let allInscriptions = [];
let cursor = 0;
const pageSize = 20;

async function connectWallet() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  try {
    if (typeof window.unisat !== 'undefined' && !isMobile) {
      const accounts = await window.unisat.requestAccounts();
      connectedAddress = accounts[0];
      alert('Connected: ' + connectedAddress);
    } else {
      const response = await fetch(`${backendUrl}/connect`);
      if (!response.ok) {
        throw new Error('Failed to fetch deeplink');
      }
      const { deeplink, nonce } = await response.json();
      window.location.href = deeplink;
      localStorage.setItem('unisatNonce', nonce);
      if (isMobile) {
        setTimeout(() => pollForAddress(nonce), 5000);
      }
      return;
    }
    document.getElementById('listForm').style.display = 'block';
    fetchAllInscriptions();
    displayListings();
  } catch (error) {
    alert('Failed to connect: ' + error.message);
  }
}

async function pollForAddress(nonce) {
  try {
    const response = await fetch(`${backendUrl}/address/${nonce}`);
    if (!response.ok) {
      setTimeout(() => pollForAddress(nonce), 2000);
      return;
    }
    const data = await response.json();
    if (data.address) {
      connectedAddress = data.address;
      alert('Connected: ' + connectedAddress);
      localStorage.removeItem('unisatNonce');
      document.getElementById('listForm').style.display = 'block';
      fetchAllInscriptions();
      displayListings();
    } else {
      setTimeout(() => pollForAddress(nonce), 2000);
    }
  } catch (error) {
    alert('Error polling address: ' + error.message);
  }
}

window.addEventListener('load', () => {
  const nonce = localStorage.getItem('unisatNonce');
  if (nonce) {
    pollForAddress(nonce);
  }
});

async function fetchAllInscriptions() {
  if (!connectedAddress) return;
  allInscriptions = [];
  cursor = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await fetch(`${backendUrl}/ordinals/${connectedAddress}?cursor=${cursor}&size=${pageSize}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch Ordinals: ${errorText}`);
      }
      const data = await response.json();
      const utxos = data.inscriptions || [];
      utxos.forEach(utxo => {
        if (utxo.inscriptions && utxo.inscriptions.length > 0) {
          allInscriptions.push(...utxo.inscriptions);
        }
      });
      cursor += pageSize;
      hasMore = allInscriptions.length < data.total;
    }
    displayUserOrdinals();
  } catch (error) {
    alert('Error fetching your Ordinals: ' + error.message);
  }
}

function displayUserOrdinals() {
  const ordinalSelect = document.getElementById('ordinalId');
  ordinalSelect.innerHTML = '<option value="">Select an Ordinal</option>';
  allInscriptions.forEach(inscription => {
    const option = document.createElement('option');
    option.value = inscription.inscriptionId;
    option.text = `Ordinal #${inscription.inscriptionNumber} (${inscription.inscriptionId})`;
    ordinalSelect.appendChild(option);
  });
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
    fetchAllInscriptions(); // Refresh after listing
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
      const deeplink = `unisat://request?method=sendBitcoin&to=${listing.seller}&amount=${satoshis}&redirect=${encodeURIComponent(appUrl)}`;
      window.location.href = deeplink;
      setTimeout(async () => {
        await fetch(`${backendUrl}/buy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index, buyer: connectedAddress })
        });
        displayListings();
        alert('Check UniSat to confirm payment!');
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
        alert('Please install UniSat Wallet extension!');
      }
    }
  } catch (error) {
    alert('Error buying item: ' + error.message);
  }
}

document.getElementById('connectWallet').addEventListener('click', connectWallet);
document.getElementById('listButton').addEventListener('click', listOrdinal);

displayListings();