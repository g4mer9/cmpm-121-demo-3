//imports=====================================================================================================================================================
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board } from "./board.ts";

//constants=====================================================================================================================================================
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const OAKES_CLASSROOM_CELL = { i: 369894, j: -1220627 };
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

//interfaces=====================================================================================================================================================
interface Coin {
  id: string;
  serial: number;
}

interface Cache {
  id: string;
  latLng: leaflet.LatLng;
  value: number;
  coins: Coin[];
  toMemento(): string;
  fromMemento(memento: string): void;
}

interface Player {
  latLng: leaflet.LatLng;
  cell: { i: number; j: number };
  marker: leaflet.Marker;
  points: number;
  ownedCoins: Coin[];
}

//instances=====================================================================================================================================================
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const playerPoints = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

const player: Player = {
  latLng: OAKES_CLASSROOM,
  cell: OAKES_CLASSROOM_CELL,
  marker: playerMarker,
  points: playerPoints,
  ownedCoins: [],
};

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const mementoCache: string[][] = [];
const activeCaches: Cache[][] = [];

//functions=====================================================================================================================================================
function setMemento(i: number, j: number, value: string) {
  if (!mementoCache[i]) {
    mementoCache[i] = [];
  }
  mementoCache[i][j] = value;
}

function setActiveCache(i: number, j: number, cache: Cache) {
  if (!activeCaches[i]) {
    activeCaches[i] = [];
  }
  activeCaches[i][j] = cache;
}

function createCache(i: number, j: number): Cache {
  const cell = board.getCellForPoint(leaflet.latLng(
    OAKES_CLASSROOM.lat + i * TILE_DEGREES,
    OAKES_CLASSROOM.lng + j * TILE_DEGREES,
  ));
  const latLng = leaflet.latLng(
    cell.i * TILE_DEGREES,
    cell.j * TILE_DEGREES,
  );
  const value = Math.floor(
    luck([cell.i, cell.j, "initialValue"].toString()) * 100,
  );
  const coins: Coin[] = [];
  for (let serial = 0; serial < value; serial++) {
    coins.push({ id: `${cell.i}:${cell.j}`, serial });
  }
  const cache: Cache = {
    id: `${cell.i},${cell.j}`,
    latLng,
    value,
    coins,
    toMemento() {
      return JSON.stringify({ value: this.value, coins: this.coins });
    },
    fromMemento(memento: string) {
      const state = JSON.parse(memento);
      this.value = state.value;
      this.coins = state.coins;
    },
  };

  // Check for existing memento
  if (mementoCache[i] && mementoCache[i][j]) {
    cache.fromMemento(mementoCache[i][j]);
  }

  return cache;
}

// All popup interactions
function handleCacheInteraction(cache: Cache) {
  const popupDiv = document.createElement("div");
  const updatePopup = () => {
    const coinList = cache.coins.map((coin) => `${coin.id}#${coin.serial}`)
      .join(", ");
    popupDiv.innerHTML = `
      <div>There is a cache here at "${cache.id}". It has value <span id="value">${cache.value}</span>.</div>
      <div>Coins: ${coinList}</div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>`;

    popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      () => {
        if (cache.value > 0) {
          cache.value--;
          player.points++;
          const collectedCoin = cache.coins.pop();
          if (collectedCoin) {
            player.ownedCoins.push(collectedCoin);
          }
          statusPanel.innerHTML = `${player.points} points accumulated`;
          updatePopup();
          saveGameState();
        }
      },
    );

    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      () => {
        if (player.points > 0 && player.ownedCoins.length > 0) {
          cache.value++;
          player.points--;
          const depositedCoin = player.ownedCoins.pop();
          if (depositedCoin) {
            cache.coins.push(depositedCoin);
          }
          statusPanel.innerHTML = `${player.points} points accumulated`;
          updatePopup();
          saveGameState();
        }
      },
    );
  };

  updatePopup();

  return popupDiv;
}

function spawnCaches() {
  for (
    let i = -NEIGHBORHOOD_SIZE + player.cell.i;
    i < NEIGHBORHOOD_SIZE + player.cell.i;
    i++
  ) {
    for (
      let j = -NEIGHBORHOOD_SIZE + player.cell.j;
      j < NEIGHBORHOOD_SIZE + player.cell.j;
      j++
    ) {
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        const cache = createCache(i, j);
        setActiveCache(i, j, cache);
        const rect = leaflet.rectangle(board.getCellBounds({ i, j }));
        rect.addTo(map);
        rect.bindPopup(() => handleCacheInteraction(cache));
      }
    }
  }
}

//Button Movement
function movePlayer(deltaLat: number, deltaLng: number) {
  //create memento for all caches in activeCaches
  for (let i = 359000; i < 370000; i++) {
    if (activeCaches[i]) {
      for (let j = -1220700; j < -1220400; j++) {
        if (activeCaches[i][j]) {
          setMemento(i, j, activeCaches[i][j].toMemento());
        }
      }
    }
  }

  player.latLng = leaflet.latLng(
    player.latLng.lat + deltaLat,
    player.latLng.lng + deltaLng,
  );
  player.cell = board.getCellForPoint(player.latLng);
  player.marker.setLatLng(player.latLng);
  map.setView(player.latLng);

  // Remove all caches
  map.eachLayer((layer: leaflet.Rectangle) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });

  spawnCaches();
  saveGameState();
  updateMovementHistory();
}

// GPS movement
function movePlayerTo(lat: number, lng: number) {
  //create memento for all caches in activeCaches
  for (let i = 359000; i < 370000; i++) {
    if (activeCaches[i]) {
      for (let j = -1220700; j < -1220400; j++) {
        if (activeCaches[i][j]) {
          setMemento(i, j, activeCaches[i][j].toMemento());
        }
      }
    }
  }
  player.latLng = leaflet.latLng(lat, lng);
  player.cell = board.getCellForPoint(player.latLng);
  player.marker.setLatLng(player.latLng);
  map.setView(player.latLng);

  // Remove all caches
  map.eachLayer((layer: leaflet.Rectangle) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });

  spawnCaches();
  saveGameState();
}

// Save/load doesnt seem to work, but it doesn't seem to break anything either.
function saveGameState() {
  const playerState = {
    latLng: player.latLng,
    cell: player.cell,
    points: player.points,
    ownedCoins: player.ownedCoins,
  };
  localStorage.setItem("player", JSON.stringify(playerState));
  localStorage.setItem("mementoCache", JSON.stringify(mementoCache));
}

function loadGameState() {
  const savedPlayer = localStorage.getItem("player");
  const savedMementoCache = localStorage.getItem("mementoCache");

  if (savedPlayer) {
    const parsedPlayer = JSON.parse(savedPlayer);
    player.latLng = leaflet.latLng(
      parsedPlayer.latLng.lat,
      parsedPlayer.latLng.lng,
    );
    player.cell = parsedPlayer.cell;
    player.points = parsedPlayer.points;
    player.ownedCoins = parsedPlayer.ownedCoins;
    player.marker.setLatLng(player.latLng);
    map.setView(player.latLng);
  }

  if (savedMementoCache) {
    Object.assign(mementoCache, JSON.parse(savedMementoCache));
  }
}

//polyline
const movementHistory: leaflet.LatLng[] = [];
function updateMovementHistory() {
  movementHistory.push(player.latLng);
  const polyline = leaflet.polyline(movementHistory, { color: "blue" });
  polyline.addTo(map);
  saveGameState();
}

//GPS button
document.getElementById("sensor")!.addEventListener("click", () => {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition((position) => {
      movePlayerTo(position.coords.latitude, position.coords.longitude);
    });
  }
});

//reset button
document.getElementById("reset")!.addEventListener("click", () => {
  if (confirm("Are you sure you want to erase your game state?")) {
    localStorage.clear();
    location.reload();
  }
});

document.getElementById("north")!.addEventListener(
  "click",
  () => movePlayer(TILE_DEGREES, 0),
);
document.getElementById("south")!.addEventListener(
  "click",
  () => movePlayer(-TILE_DEGREES, 0),
);
document.getElementById("east")!.addEventListener(
  "click",
  () => movePlayer(0, -TILE_DEGREES),
);
document.getElementById("west")!.addEventListener(
  "click",
  () => movePlayer(0, TILE_DEGREES),
);

//main=====================================================================================================================================================
loadGameState();
spawnCaches();
