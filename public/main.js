import * as vis from './libs/vis-network@10.0.2/vis-network.min.js';
import { marked } from './libs/marked@16.3.0/marked.esm.min.js';
import KeenSlider from './libs/keen-slider@4.2.6/keen-slider.esm.js';

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
        "intention": {
          "color": "Sienna", "arrows": "to", "length": 200
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
          "color": "DarkSeaGreen", "arrows": "to", "length": 150
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
          "color": "SlateBlue", "arrows": "to", "length": 150
        },
        "former-superior": {
          "color": "DarkOrchid", "arrows": "to", "length": 200
        },
        "creator": {
          "color": "Gold", "arrows": "to", "length": 150
        },
        "same-person": {
          "color": "Goldenrod", "arrows": "from,to", "length": 150
        },
        "clone": {
          "color": "BurlyWood", "arrows": "to", "length": 150
        },
        "belongs": {
          "color": "LightSlateGray", "arrows": "to", "length": 150
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
    console.log('Nodes:', items.length);
    console.log('Edges:', relations.length);

    state.nodes = items;
    state.edges = relations;
    let options = await opts.json();

    console.log(Date.now(), 'Graph construction...')
    initGraph(options);

    // prepare characters data for sidebar view
    const characters = await details.json();
    state.characters = transformCharactersData(items, characters);
    console.log('Characters:', state.characters)
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function transformCharactersData(nodes, details) {
  // Create a Map for quick access to Details by ID
  const detailsMap = new Map(details.map(d => [d.id, d]));

  // Supplement each Node with data from Map
  return nodes.map(node => {
    const detail = detailsMap.get(node.id);

    // Base object
    const data = {
      id: node.id,
      name: node.label.split(/\r?\n|\r|\n/g)[0]?.trim() || '',
      title: node.label.split(/\r?\n|\r|\n/g)[1]?.trim().slice(1, -1) || '',
      ...node
    };

    // Add/overwrite fields from Map
    if (detail) {
      data.name = detail.name || node.label;
      data.description = detail.desc || 'No description';

      // Add all the remaining fields from Map
      Object.assign(data, detail);

      // Handling images from Map
      data.images = detail.images?.length > 0 
        ? detail.images 
        : node.image ? [{ image: node.image, label: 'icon' }] : [];
    } else {
      // If Map doesn't have any additional images, add the Node icon as a single image.
      data.images = node.image 
        ? [{ image: node.image, label: 'icon' }] 
        : [];
      data.description = 'No description';
    }

    return data;
  });
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
  console.log('Filters:', state.availableChapters.length);

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

// Show character details (open sidebar)
function showNodeDetails(nodeId) {
  console.log('showNodeDetails', nodeId);

  const data = state.characters.find(n => n.id == nodeId);

  state.selectedNode = nodeId;

  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('sidebarContent');

  // Generating HTML with details
  content.innerHTML = `
        <div class="character-details">
            <div class="character-visual">
                <div class="character-slider">
                    <div id="imageSlider" class="keen-slider"></div>
                </div>
            </div>
            <div class="character-name"><h3>${data.name}</h3><strong>${data.title}</strong></div>
            <p>${data.description}</p>
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

  // Get Voices
  if (data.cv) {
    let voiceActorsContainer = document.createElement('div');
    voiceActorsContainer.className = 'character-voices';
    voiceActorsContainer.innerHTML = `
      <p><strong>CV:</strong> ${data["cv-links"]?.[0] ?
      `<a href="${data["cv-links"][0]}" rel="nofollow">${data.cv || 'Unknown'}</a>`
      : `${data.cv || 'Unknown'}`}</p>
    `;
    characterDetails.append(voiceActorsContainer);
  }

  // Get Relations
  let relationContainer = document.createElement('div');
  relationContainer.className = 'character-relations';
  let relations = state.edges.filter(rel => rel.from == nodeId || rel.to == nodeId);
  // console.log('Relations:', relations);
  relations.forEach(rel => {
    relationContainer.append(createSidebarRelation(rel, nodeId));
  });
  characterDetails.append(relationContainer);

  if (data.images) {
    const sliderElement = document.getElementById('imageSlider');

    // Prepare HTML for Keen Slider
    sliderElement.innerHTML = data.images.map(item => `
        <div class="keen-slider__slide">
            <img src="${item.image}" alt="${item.label}">
            <span class="character-image__label">${item.label}</span>
        </div>
    `).join('');

    // Initialize Keen Slider
    var slider = new KeenSlider(
      '#imageSlider',
      {
        loop: true,
        created: () => {
          if (data.images.length > 1) sliderElement.classList.add('active');
        },
      },
      [
        // add plugins here
      ]
    );
  }

  // Scroll to top
  requestAnimationFrame(() => {
    content.scrollTop = 0;
  });

  sidebar.classList.add('open');
}

function createSidebarRelation(rel, charId) {
  const dir = rel.arrows && rel.arrows != 'from,to' ? rel.from == charId ? 'character-relations__link--reverse' : 'character-relations__link--direct' : 'character-relations__link--mutual';
  const relId = rel.from == charId ? rel.to : rel.from;
  const data1 = state.characters.find(n => n.id == relId);
  const data2 = state.characters.find(n => n.id == charId);

  let el = document.createElement('button');
  el.type = 'button';
  el.className = 'character-relations__link ' + dir;
  // Generating HTML with details
  el.innerHTML = `
        <div class="character-relations__info">
          <div class="character-relations__name">${data1.name}</div>
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
  if (!state.selectedNode) return;
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.remove('open');
  state.selectedNode = null;
}


function findNode () {
  if (!state.selectedNode) return;
  state.network.focus(state.selectedNode, {
    offset: { x: -180, y: 0 },
    animation: true
  });
}

// Handling swipes for mobile devices
function initSwipe() {
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwapping = false;
  const swipeThreshold = 60;

  const handleSwipeStart = (event) => {
    if (event.target.closest('.keen-slider.active')) return;
    isSwapping = true;
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
  };

  const handleSwipeEnd = (event) => {
    const sidebar = document.getElementById('sidebar');
    if (!isSwapping || !sidebar.classList.contains('open')) return;

    const diffX = event.changedTouches[0].clientX - touchStartX;
    const diffY = event.changedTouches[0].clientY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY) * 1.5 && diffX > swipeThreshold) closeSidebar();
    isSwapping = false;
  };

  document.addEventListener('touchstart', handleSwipeStart);
  document.addEventListener('touchend', handleSwipeEnd);
}

function initDragSidebar() {
  let mouseDown = false;
  let mouseStartPoint = 0;
  let mouseStartY = 0;
  let scrollStartY = 0;
  let isDragging = false;
  let isScrolling = false;
  let lastX = 0;
  let lastDirection = null;
  const dragThreshold = 4;
  const closeThreshold = 80;

  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('sidebarContent');

  const handleDragStart = (event) => {
    if (event.target.closest('.keen-slider.active')) return;
    if (!sidebar.classList.contains('open')) return;

    mouseDown = true;
    mouseStartPoint = event.clientX;
    mouseStartY = event.clientY;
    scrollStartY = content.scrollTop;
    isDragging = false;
    isScrolling = false;
    lastX = event.clientX;
    lastDirection = null;
  };

  const handleDragMove = (event) => {
    if (!mouseDown) return;

    if (event.buttons === 1) {
      const deltaX = Math.abs(event.clientX - mouseStartPoint);
      const deltaY = Math.abs(event.clientY - mouseStartY);

      // Determine the action
      if (!isDragging && !isScrolling) {
        if (deltaY > deltaX && deltaY > dragThreshold) {
          isScrolling = true;
        } else if (deltaX > deltaY && deltaX > dragThreshold) {
          isDragging = true;
        }
      }

      if (isScrolling || isDragging) {
        event.preventDefault();
        sidebar.style.userSelect = 'none';
        window.getSelection().removeAllRanges();
      }

      if (isScrolling) {
        const deltaY = event.clientY - mouseStartY;
        content.scrollTop = scrollStartY - deltaY;
      }

      if (isDragging) {
        let x = event.clientX - mouseStartPoint;
        sidebar.style.transition = '0s';
        sidebar.style.transform = `translateX(${ x >= 0 ? x : 0 }px)`;
      }

      // Track direction
      if (event.clientX > lastX) {
        lastDirection = 'right';
      } else if (event.clientX < lastX) {
        lastDirection = 'left';
      }
      lastX = event.clientX;
    } else {
      handleDragEnd(event)
    }
  };

  const handleDragEnd = (event) => {
    if (!sidebar.classList.contains('open')) return;
    event.preventDefault();

    if (isDragging) {
      let x = event.clientX - mouseStartPoint;
      if (x > closeThreshold && lastDirection !== 'left') {
        closeSidebar();
      }
    }

    // State reset
    mouseDown = false;
    isDragging = false;
    isScrolling = false;
    sidebar.style.transition = '';
    sidebar.style.transform = '';
    sidebar.style.userSelect = '';
  };

  sidebar.addEventListener('mousedown', handleDragStart);
  window.addEventListener('mousemove', handleDragMove);
  window.addEventListener('mouseup', handleDragEnd);
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initSwipe();
  initDragSidebar();

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

  const sidebarContent = document.getElementById('sidebarContent');
  const sidebarHeader = document.querySelector('.sidebar-controls');
  if (sidebarContent && sidebarHeader) {
    sidebarContent.addEventListener('scroll', () => {
      const scrollY = sidebarContent.scrollTop;
      sidebarHeader.classList.toggle('sidebar-controls--scrolled', scrollY >= 100);
    });
  }

  // Adaptation when resizing a window
  // window.addEventListener('resize', () => {
  //   state.network.fit();
  // });
});
