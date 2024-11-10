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
interface Cache {
  id: string;
  latLng: leaflet.LatLng;
  value: number;
}
interface Player {
  latLng: leaflet.LatLng;
  marker: leaflet.Marker;
  points: number;
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
  marker: playerMarker,
  points: playerPoints,
};

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

//functions=====================================================================================================================================================
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
  return { id: `${cell.i},${cell.j}`, latLng, value };
}

function handleCacheInteraction(cache: Cache) {
  const popupDiv = document.createElement("div");
  popupDiv.innerHTML = `
    <div>There is a cache here at "${cache.id}". It has value <span id="value">${cache.value}</span>.</div>
    <button id="collect">Collect</button>
    <button id="deposit">Deposit</button>`;

  popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
    "click",
    () => {
      if (cache.value > 0) {
        cache.value--;
        player.points++;
        statusPanel.innerHTML = `${player.points} points accumulated`;
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
          .value.toString();
      }
    },
  );

  popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
    "click",
    () => {
      if (player.points > 0) {
        cache.value++;
        player.points--;
        statusPanel.innerHTML = `${player.points} points accumulated`;
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
          .value.toString();
      }
    },
  );

  return popupDiv;
}

function spawnCaches() {
  for (
    let i = -NEIGHBORHOOD_SIZE + OAKES_CLASSROOM_CELL.i;
    i < NEIGHBORHOOD_SIZE + OAKES_CLASSROOM_CELL.i;
    i++
  ) {
    for (
      let j = -NEIGHBORHOOD_SIZE + OAKES_CLASSROOM_CELL.j;
      j < NEIGHBORHOOD_SIZE + OAKES_CLASSROOM_CELL.j;
      j++
    ) {
      if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
        const cache = createCache(i, j);
        const rect = leaflet.rectangle(board.getCellBounds({ i, j }));
        console.log(board.getCellBounds({ i, j }));
        rect.addTo(map);
        rect.bindPopup(() => handleCacheInteraction(cache));
      }
    }
  }
}

//main=====================================================================================================================================================
spawnCaches();
