import * as vis from './libs/vis-network@10.0.2/vis-network.min.js';
import { marked } from './libs/marked@16.3.0/marked.esm.min.js';

const state = {
  nodes: [],
  edges: [],
  network: null,
  selectedNode: null,
  theme: 'system'
};



async function loadData() {

    function transformData(data) {
      const typeConfig = {
        "action": {
          "color": "FireBrick", "arrows": "to", "length": 200
        },
        "family": {
          "color": "SeaGreen", "length": 100
        },
        "parent": {
          "color": "Green", "arrows": "to", "length": 150
        },
        "ancestor": {
          "color": "Olive", "arrows": "to", "length": 150
        },
        "distant-relatives": {
          "color": "DarkSeaGreen", "arrows": "to", "length": 150, "title": "Distant Relatives"
        },
        "co-worker": {
          "color": "Turquoise", "length": 300
        },
        "crew": {
          "color": "DarkCyan", "length": 300
        },
        "teacher": {
          "color": "Orange", "arrows": "to", "length": 200
        },
        "superior": {
          "color": "SlateBlue", "arrows": "to"
        },
        "former-superior": {
          "color": "DarkOrchid", "arrows": "to"
        },
        "creator": {
          "color": "Gold", "arrows": "to", "length": 150
        },
        "same-person": {
          "color": "Goldenrod", "arrows": "from,to", "length": 150
        },
        "clone": {
          "color": "BurlyWood", "arrows": "to", "length": 150, "title": "Clone"
        }
      };

      const relations = [];
      
      const itemsWithoutRelations = data.map(item => {
        const { relations: itemRelations, ...rest } = item;
        
        // Fill relations array
        relations.push(...itemRelations.map(relation => ({
          ...relation,
          from: item.id,
          // Add configuration only if there is a type
          ...(relation.type && typeConfig[relation.type] && {
            ...typeConfig[relation.type]
          })
        })));
        
        // Return everything except relationships.
        return rest;
      });
      
      return { items: itemsWithoutRelations, relations };
    }


  try {
    console.log(Date.now(), 'Loading data...')
    const [charactersJson, opts, details] = await Promise.all([
      fetch('./data/characters.json'),
      fetch('./data/options.json'),
      fetch('./data/details.json')
    ]);

    console.log(Date.now(), 'Data processing...')
    const charactersData  = await charactersJson.json();
    
    const { items, relations } = transformData(charactersData);
    console.log('Nodes:', items);
    console.log('Edges:', relations);

    state.nodes = items;
    state.edges = relations;
    let options = await opts.json();
    state.details = await details.json();

    console.log(Date.now(), 'Graph construction...')
    initGraph(options);
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function getChapterList(arr) {
  // Use a Map to store unique entries by chapter value (string)
  const uniqueItems = new Map();

  arr.forEach(item => {
    const key = item.chapter;
    if (key && !uniqueItems.has(key)) {
      const [arcStr, chapterStr] = key.split('.');
      const arc = parseInt(arcStr, 10);
      const chapter = parseInt(chapterStr, 10);

      uniqueItems.set(key, { arc, chapter });
    }
  });

  // Convert the Map to an array, sort it, and generate the final result.
  return Array.from(uniqueItems.entries())
    .map(([key, { arc, chapter }]) => ({
      label: `Arc ${arc}, Ch. ${chapter}`,
      arc: arc,
      chapter: chapter
    }))
    .sort((a, b) => {
      if (a.arc !== b.arc) return a.arc - b.arc;
      return a.chapter - b.chapter;
    });
}

// Initialize the graph
function initGraph(opts) {
  const container = document.getElementById('graph-container');

  // Creating DataSets for vis.js
  const nodes = new vis.DataSet(state.nodes);
  const edges = new vis.DataSet(state.edges);

  state.availableChapters = getChapterList(state.edges);
  console.log('Filters:', state.availableChapters);

  // Filtering state (stored in state)
  state.filters = {
    edges: false,
    arc: 0,
    chapter: 0,
    selectedRelations: new Set() // if filtering by relations is needed
  };

  // Filtering function for edges
  const edgesFilter = (edge) => {
    if (!state.filters.edges) return true;

    let chapterOk = true;
    if (edge.chapter) {
      const [arcStr, chapterStr] = edge.chapter.split('.');
      const arc = parseInt(arcStr, 10);
      const chapter = parseInt(chapterStr, 10);

      if (arc > state.filters.arc && chapter > state.filters.chapter) return false;
      // chapterOk = true;
    }
    // Filter by chapter (show only edges with chapter <= chapter)
    // const chapterOk = (edge.chapter || 0) <= state.filters.chapter.value;

    // Additional filters can be added here
    // For example, a filter by relationship type:
    // const relationOk = state.filters.selectedRelations.size === 0 || 
    //                   state.filters.selectedRelations.has(edge.relation);
    
    return chapterOk; // && relationOk;
  };

  // Filter function for nodes (if needed)
  const nodesFilter = (node) => {
    // Node filtering can be added here
    // For example, show only nodes that have visible edges
    return true;
  };

  // Create a DataView for the filtered edges
  state.edgesView = new vis.DataView(edges, { filter: edgesFilter });
  
  // Create a DataView for the nodes (if filtering is needed)
  state.nodesView = new vis.DataView(nodes, { filter: nodesFilter });

  const options = {
    nodes: {
      font: {
        size: 14,
        color: getComputedStyle(document.documentElement)
          .getPropertyValue('--text-color').trim()
      }
    }
  };

  state.network = new vis.Network(container, { nodes: state.nodesView, edges: state.edgesView }, Object.assign(options, opts));

  // Event handlers
  initNetworkEvents();
  initTimeline();
}

function initNetworkEvents() {

  // Event handlers
  state.network.on('click', function (params) {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      showNodeDetails(nodeId);
    }
  });

  // Deselect handler (close sidebar)
  state.network.on('deselectNode', function (params) {
    closeSidebar();
  });

  state.network.once('stabilizationIterationsDone', function () {
    // Centering on a specific node
    state.network.focus(3990219000, {
      scale: 1.0,
      animation: false
    });

    initAfter();
  });

}

function initAfter() {
  showTimeline();
  // setEdgeFilter([['chapter', 0]]);

  console.log(Date.now(), 'The graph has been successfully constructed.');
}

function initTimeline() {
  const timeline = document.getElementById('timeline');
  const content = timeline.querySelector('.timeline-content')
  if (!timeline || !content) return;

  state.availableChapters.forEach((filter, index) => {
    let el = document.createElement('div');
    el.className = `timeline-item${ index === 0 ? ' active': '' }`;
    el.tabIndex = 0;
    el.innerHTML = `
      <div class="timeline-marker"></div>
      <div class="timeline-label">${ filter.label }</div>
    `

    content.append(el);

    el.addEventListener('click', (e) => {
      content.querySelectorAll('.timeline-item').forEach((el) => {
        el.classList.remove('active');
      })
      e.target.closest('.timeline-item').classList.add('active');
      setEdgeFilter([['chapter', filter.chapter]]);
    });
  });
}

function showTimeline() {
  const timeline = document.getElementById('timeline');
  if (!timeline) return;

  timeline.classList.add('active');
}

function setEdgeFilter(filters) {
  filters.forEach(filter => {
    const [type, value] = filter;
    if (!state.filters || !state.filters.hasOwnProperty(type)) return;
    state.filters[type] = value;
  })

  // Apply a filter (recalculate the DataView)
  if (state.edgesView) {
    state.edgesView.refresh();
  }
}

// Function to get character details with priority from details
function getCharacterDetails(node) {
  if (!node) return null;

  // Get details by character ID
  const data = state.details.find(x => x.id === node.id);
  if (!data) return null;

  // Using information from details
  return {
    label: data.name || node.label,
    image: data.image || node.image,
    description: data.desc || 'No description',
    race: data.race || node.details?.race || 'Unknown',
    cv: data.cv || 'Unknown',
    // Additional fields from details
    ...data
  };
}

// Show character details (open sidebar)
function showNodeDetails(nodeId) {
  console.log('showNodeDetails', nodeId);

  const node = state.nodes.find(n => n.id == nodeId);
  if (!node) return;

  // Get character details
  const details = getCharacterDetails(node);
  const data = details ? details : node;

  state.selectedNode = node;

  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('sidebarContent');

  // Scroll to top
  requestAnimationFrame(() => {
    content.scrollTop = 0;
  });

  // Generating HTML with details
  content.innerHTML = `
        <div class="character-details">
            <div class="character-visual">
              ${data.image ?
        `<img src="${data.image}" alt="${data.label}" class="character-image">`
        : ''}
            </div>
            <div class="character-name"><h3>${data.label}</h3></div>
            <p><strong>Race:</strong> ${data.race || 'Unknown'}</p>
            <p>${data.description || 'No description'}</p>
            <div class="character-voice">
              <p><strong>CV:</strong> ${data["cv-links"] ?
        `<a href="${data["cv-links"][0]}" rel="nofollow">${data.cv || 'Unknown'}</a>`
        : `${data.cv || 'Unknown'}`}</p>
            </div>
        </div>
    `;

  
  let wikiLink = sidebar.querySelector('.gbf-link');
  if (wikiLink) wikiLink.classList.add('hidden');

  if (data.links?.length > 0) {
    data.links.forEach(link => {
      if (link.includes('https://gbf.wiki/')) {
        if (!wikiLink) return;
        wikiLink.href = link;
        wikiLink.classList.remove('hidden');
      }
    });
  }

  
  const characterDetails = content.querySelector('.character-details');

  // Get Relations
  let relationContainer = document.createElement('div');
  relationContainer.className = 'character-relations';
  let relations = state.edges.filter(rel => rel.from == nodeId || rel.to == nodeId);
  // console.log('Relations:', relations);
  relations.forEach(rel => {
    relationContainer.append(createSidebarRelation(rel, nodeId));
  });
  characterDetails.append(relationContainer);

  sidebar.classList.add('open');
}

function createSidebarRelation(rel, charId) {
  const dir = rel.arrows && rel.arrows != 'from,to' ? rel.from == charId ? 'character-relations__link--reverse' : 'character-relations__link--direct' : 'character-relations__link--mutual';
  const relId = rel.from == charId ? rel.to : rel.from;
  const data1 = state.nodes.find(n => n.id == relId);
  const data2 = state.nodes.find(n => n.id == charId);

  let el = document.createElement('button');
  el.type = 'button';
  el.className = 'character-relations__link ' + dir;
  // Generating HTML with details
  el.innerHTML = `
        <div class="character-relations__info">
          <div class="character-relations__name">${data1.label.split(/\r?\n|\r|\n/g, 1)[0]}</div>
          <div class="character-relations__type">${rel.title ? rel.type ? rel.title + ' (' + rel.type + ')' : rel.title : rel.type ? rel.type : 'relation'}</div>
          <div class="character-relations__ribbon"></div>
        </div>
    `;

  function createIcon (data) {
    const icon = document.createElement('div');
    icon.className = 'character-relations__avatar';
    if (data.image) icon.style.backgroundImage = `url(${data.image})`;
    return icon;
  }

  el.addEventListener('click', () => {
    showNodeDetails(data1.id)
  });

  const icon1 = createIcon(data1)
  const icon2 = createIcon(data2)

  el.prepend(icon1);
  el.append(icon2);

  return el;
}


function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.remove('open');
  state.selectedNode = null;
}


function findNode () {
  if (!state.selectedNode || !state.selectedNode.id) return;
  console.log(state.selectedNode);
  state.network.focus(state.selectedNode.id, {
    offset: { x: -180, y: 0 },
    animation: true
  });
}

// Handling swipes for mobile devices
function initSwipe() {
  let touchStart = 0;

  document.addEventListener('touchstart', (e) => {
    touchStart = e.changedTouches[0].clientX;
  });

  document.addEventListener('touchend', (e) => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar.classList.contains('open')) return;

    const diff = e.changedTouches[0].clientX - touchStart; // swipe right
    if (diff > 50) {
      closeSidebar();
    }
  });
  

  let mouseDown = false;
  let mouseStartPoint = 0;
  const sidebar = document.getElementById('sidebar');
  sidebar.addEventListener("mousedown", (event) => {
    if (!sidebar.classList.contains('open')) return;
    mouseDown = true;
    mouseStartPoint = event.clientX;
    sidebar.style.transition = '0s';
    sidebar.style.userSelect = 'none';
  });

  window.addEventListener("mouseup", (event) => {
    if (!sidebar.classList.contains('open')) return;

    let x = 0;
    if (mouseDown) {
      x = event.clientX - mouseStartPoint;
    }
    mouseDown = false;
    mouseStartPoint = 0;
    sidebar.style.transition = '';
    sidebar.style.transform = '';
    sidebar.style.userSelect = '';
    
    if (x > 100) {
      closeSidebar();
    }
  });

  window.addEventListener('mousemove', function(event) {
    if (mouseDown) {
      let x = event.clientX - mouseStartPoint;
      sidebar.style.transform = `translateX(${ x >= 0 ? x : 0 }px)`;
    }
  });
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initSwipe();

  // Centering on a specific node
  const toggleRelations = document.getElementById('toggleRelations');
  toggleRelations.addEventListener('click', () => {
    setEdgeFilter([['edges', !state.filters.edges]]);
    toggleRelations.classList.toggle('active');
  });

  // Centering on a specific node
  document.getElementById('findNode').addEventListener('click', () => {
    findNode();
  });

  // Closing the sidebar with Button
  document.getElementById('closeSidebar').addEventListener('click', () => {
    closeSidebar();
  });

  // Closing the sidebar with Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSidebar();
    }
  });

  // Adaptation when resizing a window
  // window.addEventListener('resize', () => {
  //   state.network.fit();
  // });
});
