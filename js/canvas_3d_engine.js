/**
 * Project Map 3D Engine (Three.js + CSS3DRenderer + WebGL)
 * 
 * Features:
 * - 3D Multi-Layer / Tower Architecture (Z-Axis Layering)
 * - CSS3DRenderer for Crystal-Clear Interactive HTML Nodes (Checklist, Schema, Markdown)
 * - 3D Curved Neon Data Pipeline Edges
 * - Smooth Cinematic Camera Fly-to Transitions
 * - 3D Spatial Radar & Orientation Compass Minimap
 * - Comprehensive Keyboard Shortcuts
 */

class Canvas3DEngine {
  constructor(containerElement, radarCanvasElement) {
    this.container = containerElement;
    this.radarCanvas = radarCanvasElement;
    this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;

    // 모드 상태
    this.is3DMode = true;
    this.nodes = [];
    this.edges = [];
    this.nodeMap = new Map();
    this.cssObjects = new Map();

    // 레이어 정의 (Z축)
    this.layers = {
      'ai': { z: 450, name: 'AI 오케스트레이션 층', color: '#a855f7' },
      'core': { z: 150, name: '런처 & 데스크톱 층', color: '#38bdf8' },
      'backend': { z: -150, name: '백엔드 & 검색 엔진 층', color: '#10b981' },
      'database': { z: -450, name: '데이터베이스 & 인프라 층', color: '#f59e0b' },
      'finance': { z: -150, name: '트레이딩 엔진 층', color: '#eab308' }
    };

    this.selectedNodeId = null;
    this.animatingCamera = false;

    // 콜백들
    this.onNodeClick = null;
    this.onNodeDoubleClick = null;
    this.onDataChange = null;

    this.initThree();
    this.initLightsAndFloor();
    this.initEvents();
    this.animate();
  }

  initThree() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. Three.js Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d14);
    this.scene.fog = new THREE.FogExp2(0x0a0d14, 0.00035);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 20000);
    this.camera.position.set(0, -1800, 1500);

    // 3. WebGL Renderer (배경, 그리드 플로어, 3D 파이프라인 라인)
    this.webglRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.webglRenderer.setSize(width, height);
    this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.webglRenderer.domElement.style.position = 'absolute';
    this.webglRenderer.domElement.style.top = '0';
    this.webglRenderer.domElement.style.left = '0';
    this.webglRenderer.domElement.style.zIndex = '1';
    this.container.appendChild(this.webglRenderer.domElement);

    // 4. CSS3DRenderer (HTML5 노드 인터랙션 3D 평면 렌더링)
    this.cssRenderer = new THREE.CSS3DRenderer();
    this.cssRenderer.setSize(width, height);
    this.cssRenderer.domElement.style.position = 'absolute';
    this.cssRenderer.domElement.style.top = '0';
    this.cssRenderer.domElement.style.left = '0';
    this.cssRenderer.domElement.style.zIndex = '2';
    this.container.appendChild(this.cssRenderer.domElement);

    // 5. OrbitControls (3D 카메라 회전, 팬, 줌)
    this.controls = new THREE.OrbitControls(this.camera, this.cssRenderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 200;
    this.controls.maxDistance = 8000;
    this.controls.target.set(600, 400, 0);

    // 엣지 라인들을 담을 3D 그룹
    this.edgeGroup = new THREE.Group();
    this.scene.add(this.edgeGroup);

    // 층별 그리드 평면 그룹
    this.floorGroup = new THREE.Group();
    this.scene.add(this.floorGroup);
  }

  initLightsAndFloor() {
    // 엠비언트 라이트
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    // 디렉셔널 라이트
    const dirLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    dirLight.position.set(500, -1000, 1500);
    this.scene.add(dirLight);

    // 3D 별빛 파티클
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1200;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 8000;
      starPositions[i + 1] = (Math.random() - 0.5) * 8000;
      starPositions[i + 2] = (Math.random() - 0.5) * 3000;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x38bdf8, size: 2.5, transparent: true, opacity: 0.5 });
    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);

    // Z축 층별 그리드 플로어 구축
    this.buildFloorPlanes();
  }

  buildFloorPlanes() {
    // 기존 플로어 제거
    while (this.floorGroup.children.length > 0) {
      this.floorGroup.remove(this.floorGroup.children[0]);
    }

    const planeSize = 3000;
    const gridDivisions = 30;

    Object.entries(this.layers).forEach(([cat, info]) => {
      // 층 그리드 헬퍼 (XY 평면 상에 Z값 적용)
      const grid = new THREE.GridHelper(planeSize, gridDivisions, info.color, 0x1f293d);
      grid.rotation.x = Math.PI / 2; // XY 평면으로 눕힘
      grid.position.set(600, 400, info.z);
      grid.material.opacity = 0.25;
      grid.material.transparent = true;
      this.floorGroup.add(grid);
    });
  }

  initEvents() {
    window.addEventListener('resize', () => this.onWindowResize());

    // 마우스 우클릭 기본 방지
    this.cssRenderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.webglRenderer.setSize(width, height);
    this.cssRenderer.setSize(width, height);
  }

  // 데이터 로드 및 3D 씬 구축
  setData(nodes, edges) {
    this.nodes = nodes || [];
    this.edges = edges || [];

    this.nodeMap.clear();
    this.nodes.forEach(n => {
      // Z축 좌표가 없으면 카테고리 기반 층(Layer) 자동 지정
      if (n.z === undefined || n.z === null) {
        const layerInfo = this.layers[n.category] || { z: 0 };
        n.z = layerInfo.z;
      }
      this.nodeMap.set(n.id, n);
    });

    this.build3DNodes();
    this.build3DEdges();
  }

  // 3D HTML 인터랙티브 노드 생성 (CSS3DObject)
  build3DNodes() {
    // 기존 CSS3DObject들 제거
    this.cssObjects.forEach(obj => {
      this.scene.remove(obj);
    });
    this.cssObjects.clear();

    this.nodes.forEach(node => {
      const element = this.createNodeHTMLElement(node);
      const cssObject = new THREE.CSS3DObject(element);

      // 3D 월드 좌표 배치 (중심점 보정)
      cssObject.position.set(node.x + node.width / 2, node.y + node.height / 2, node.z || 0);

      this.scene.add(cssObject);
      this.cssObjects.set(node.id, cssObject);
    });
  }

  // 리치 HTML 노드 DOM 엘리먼트 생성
  createNodeHTMLElement(node) {
    const el = document.createElement('div');
    el.className = 'node-3d-card';
    el.id = `node-3d-${node.id}`;
    el.style.width = `${node.width}px`;
    el.style.minHeight = `${node.height}px`;

    const layerInfo = this.layers[node.category] || { name: '일반 레이어', color: '#38bdf8' };

    // HTML 내부 구조 (체크리스트, 스키마, 마크다운 완벽 지원)
    let contentHtml = '';
    if (node.type === 'checklist' && node.data && node.data.items) {
      const total = node.data.items.length;
      const done = node.data.items.filter(i => i.done).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      contentHtml += `
        <div class="node-progress-bar"><div class="fill" style="width: ${pct}%"></div></div>
        <div class="node-checklist-items">
          ${node.data.items.map((it, idx) => `
            <div class="chk-item ${it.done ? 'done' : ''}" onclick="window.app.toggleChecklistItem('${node.id}', ${idx})">
              <span>${it.done ? '✓' : '○'}</span> ${it.text}
            </div>
          `).join('')}
        </div>
      `;
    } else if (node.type === 'db_schema' && node.data) {
      contentHtml += `
        <div class="node-db-title">TABLE: ${node.data.table_name || 'table'}</div>
        <div class="node-db-cols">
          ${(node.data.columns || []).map(col => `
            <div class="db-col"><span>${col.name}</span><span class="type">${col.type}</span></div>
          `).join('')}
        </div>
      `;
    } else if (node.type === 'markdown' && node.data) {
      contentHtml += `<div class="node-md-text">${node.data.content ? node.data.content.replace(/\n/g, '<br>') : ''}</div>`;
    } else {
      contentHtml += `<div class="node-desc-text">${node.description || ''}</div>`;
      if (node.tags && node.tags.length > 0) {
        contentHtml += `<div class="node-tags-row">${node.tags.map(t => `<span>#${t}</span>`).join('')}</div>`;
      }
    }

    el.innerHTML = `
      <div class="node-3d-header" style="background: ${this.getNodeHeaderGradient(node.category)}">
        <div class="node-title" title="${node.title}">${node.title}</div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <div class="node-layer-badge" style="border-color:${layerInfo.color}; color:${layerInfo.color}">${layerInfo.name}</div>
          <button class="node-action-btn edit-btn" title="노드 수정 (꾹 누르기 또는 터치)" onclick="event.stopPropagation(); window.app.openNodeEditModalFor('${node.id}');">✏️</button>
          <button class="node-action-btn del-btn" title="노드 삭제" onclick="event.stopPropagation(); window.app.deleteNodeById('${node.id}');">🗑️</button>
        </div>
      </div>
      <div class="node-3d-body">
        ${contentHtml}
      </div>
    `;

    // 롱 프레스 (Long Press - 450ms 꾹 누르기 감지)
    let pressTimer = null;
    let isLongPressTriggered = false;

    const onTouchStart = (e) => {
      isLongPressTriggered = false;
      el.classList.add('pressing');
      pressTimer = setTimeout(() => {
        isLongPressTriggered = true;
        el.classList.remove('pressing');
        if (navigator.vibrate) navigator.vibrate(60);
        this.selectNode(node.id);
        window.app.openNodeEditModalFor(node.id);
      }, 450);
    };

    const onTouchCancel = () => {
      el.classList.remove('pressing');
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchCancel, { passive: true });
    el.addEventListener('touchend', (e) => {
      onTouchCancel();
      if (!isLongPressTriggered) {
        this.selectNode(node.id);
        if (this.onNodeClick) this.onNodeClick(node);
      }
    });

    // 마우스 이벤트 바인딩
    el.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      onTouchStart(e);
      this.selectNode(node.id);
      if (this.onNodeClick) this.onNodeClick(node);
    });

    el.addEventListener('mousemove', onTouchCancel);
    el.addEventListener('mouseup', onTouchCancel);

    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.flyToNode(node);
      if (this.onNodeDoubleClick) this.onNodeDoubleClick(node);
    });

    return el;
  }

  getNodeHeaderGradient(cat) {
    switch (cat) {
      case 'ai': return 'linear-gradient(90deg, #4c1d95, #6b21a8)';
      case 'core': return 'linear-gradient(90deg, #1e3a5f, #1e40af)';
      case 'backend': return 'linear-gradient(90deg, #064e3b, #047857)';
      case 'database': return 'linear-gradient(90deg, #78350f, #92400e)';
      case 'finance': return 'linear-gradient(90deg, #713f12, #854d0e)';
      default: return 'linear-gradient(90deg, #1e293b, #334155)';
    }
  }

  // 3D 네온 튜브 연결선 (3D Curved Pipeline) 구축
  build3DEdges() {
    while (this.edgeGroup.children.length > 0) {
      const child = this.edgeGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.edgeGroup.remove(child);
    }

    this.edges.forEach(edge => {
      const fromNode = this.nodeMap.get(edge.from);
      const toNode = this.nodeMap.get(edge.to);
      if (!fromNode || !toNode) return;

      const p1 = new THREE.Vector3(fromNode.x + fromNode.width, fromNode.y + fromNode.height / 2, fromNode.z || 0);
      const p2 = new THREE.Vector3(toNode.x, toNode.y + toNode.height / 2, toNode.z || 0);

      // 3D 베지어 곡선 생성
      const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      // Z축 차이가 있을 경우 입체 아치 형성
      const zDiff = Math.abs(p2.z - p1.z);
      midPoint.z += Math.max(zDiff * 0.3, 100);

      const curve = new THREE.QuadraticBezierCurve3(p1, midPoint, p2);
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 2.8, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: edge.color || 0x38bdf8,
        emissive: edge.color || 0x38bdf8,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8
      });

      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      this.edgeGroup.add(tubeMesh);
    });
  }

  // 노드 선택
  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    document.querySelectorAll('.node-3d-card').forEach(el => el.classList.remove('selected'));
    const el = document.getElementById(`node-3d-${nodeId}`);
    if (el) el.classList.add('selected');
  }

  // 카메라 비행 애니메이션 (Fly-to Node)
  flyToNode(node) {
    if (!node) return;
    const targetPos = new THREE.Vector3(node.x + node.width / 2, node.y + node.height / 2, node.z || 0);
    // 정면에서 쳐다보도록 카메라 배치
    const cameraOffset = new THREE.Vector3(0, -550, 200);
    const cameraTargetPos = new THREE.Vector3().addVectors(targetPos, cameraOffset);

    this.animateCamera(cameraTargetPos, targetPos, 1000);
  }

  // 카메라 시점 프리셋
  setViewPreset(preset) {
    const center = new THREE.Vector3(600, 400, 0);

    switch (preset) {
      case 'top': // 1번 키: Top 뷰 (평면 조감도)
        this.animateCamera(new THREE.Vector3(600, 400, 2400), center, 800);
        break;
      case 'front': // 2번 키: Front 뷰 (Z축 층별 조망)
        this.animateCamera(new THREE.Vector3(600, -2200, 0), center, 800);
        break;
      case 'iso': // 3번 키: Isometric 입체 사선 뷰
        this.animateCamera(new THREE.Vector3(-1200, -1600, 1400), center, 800);
        break;
      case 'reset': // R 키: 기본 홈 뷰
        this.animateCamera(new THREE.Vector3(0, -1800, 1500), center, 800);
        break;
    }
  }

  // 카메라 위치 보간 애니메이션
  animateCamera(toCamPos, toTargetPos, durationMs = 800) {
    this.animatingCamera = true;
    const startCamPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startTime = performance.now();

    const step = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // EaseInOutCubic
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(startCamPos, toCamPos, ease);
      this.controls.target.lerpVectors(startTarget, toTargetPos, ease);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        this.animatingCamera = false;
      }
    };
    requestAnimationFrame(step);
  }

  // 층(Layer) 위/아래 이동
  shiftLayer(direction) {
    const zSteps = [450, 150, -150, -450];
    const currentZ = this.controls.target.z;

    let targetZ = zSteps[0];
    if (direction > 0) { // 위로
      targetZ = zSteps.find(z => z > currentZ + 50) || 450;
    } else { // 아래로
      targetZ = [...zSteps].reverse().find(z => z < currentZ - 50) || -450;
    }

    const newTarget = this.controls.target.clone();
    newTarget.z = targetZ;
    const newCam = this.camera.position.clone();
    newCam.z += (targetZ - currentZ);

    this.animateCamera(newCam, newTarget, 600);
  }

  // 실시간 3D 공간 레이더 & 나침반 미니맵 렌더링
  renderRadar() {
    if (!this.radarCtx) return;
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // 1. 레이더 동심원 그리드
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;
    const cx = w / 2;
    const cy = h / 2;

    [30, 60, 90].forEach(r => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 십자선
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.stroke();

    // 2. 노드들의 3D 위치 및 Z축 높이별 점 찍기
    const scale = 0.035;
    this.nodes.forEach(n => {
      const rx = cx + (n.x - this.controls.target.x) * scale;
      const ry = cy + (n.y - this.controls.target.y) * scale;

      const layerInfo = this.layers[n.category] || { color: '#38bdf8' };
      ctx.fillStyle = layerInfo.color;
      ctx.beginPath();
      ctx.arc(rx, ry, n.id === this.selectedNodeId ? 4.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. 현재 카메라 시야 절두체 (FOV 쐐기)
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    const angle = Math.atan2(camDir.y, camDir.x);

    ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.strokeStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 40, angle - 0.35, angle + 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. 좌표 HUD 텍스트
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.fillText(`CAM Z:${Math.round(this.camera.position.z)} | TGT Z:${Math.round(this.controls.target.z)}`, 8, 14);
  }

  // 메인 애니메이션 루프
  animate() {
    requestAnimationFrame(() => this.animate());

    if (!this.animatingCamera) {
      this.controls.update();
    }

    // 별빛 회전
    if (this.stars) {
      this.stars.rotation.z += 0.0003;
    }

    this.webglRenderer.render(this.scene, this.camera);
    this.cssRenderer.render(this.scene, this.camera);

    this.renderRadar();
  }
}
