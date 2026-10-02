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
      // 📋 기획 & 플래닝 레이어 (최상위 사령탑 상단)
      'goal': { z: 750, name: '🎯 핵심 목표 / 마일스톤', color: '#f59e0b' },
      'idea': { z: 600, name: '💡 아이디어 / 기획 노트', color: '#10b981' },
      'strategy': { z: 450, name: '📝 실행 전략 / 로드맵', color: '#6366f1' },
      'task': { z: 300, name: '📌 단순 할일 / 태스크', color: '#0ea5e9' },
      // ⚙️ 시스템 & 아키텍처 레이어
      'core': { z: 150, name: '⚡ 코어 사령탑 / 런처', color: '#38bdf8' },
      'ai': { z: 0, name: '🤖 AI 에이전트 브레인', color: '#a855f7' },
      'backend': { z: -200, name: '⚙️ 백엔드 & API 파이프라인', color: '#10b981' },
      'frontend': { z: -100, name: '💻 프론트엔드 & UI', color: '#38bdf8' },
      'database': { z: -450, name: '💾 데이터베이스 & 영속성', color: '#eab308' },
      'finance': { z: -200, name: '📈 트레이딩 & 금융', color: '#f59e0b' }
    };

    this.selectedNodeId = null;
    this.animatingCamera = false;
    this.realtimeSimulationActive = true;
    this.edgeParticles = [];
    this.edgeLabels = [];

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

    const isRunning = node.status === 'running';
    el.className = `node-3d-card ${isRunning ? 'status-running' : ''}`;

    const runningBadgeHtml = isRunning 
      ? '<span class="status-badge-running"><span class="spinner-mini"></span> RUNNING</span>' 
      : '';

    el.innerHTML = `
      <div class="node-3d-header" style="background: ${this.getNodeHeaderGradient(node.category)}">
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
          <div class="node-title" title="${node.title}">${node.title}</div>
          ${runningBadgeHtml}
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
          <div class="node-layer-badge" style="border-color:${layerInfo.color}; color:${layerInfo.color}">${layerInfo.name}</div>
          <button class="node-action-btn run-btn" title="이 노드부터 시뮬레이션 실행" style="color: #00f0ff;" onclick="event.stopPropagation(); window.app.sim.start('${node.id}');">⚡</button>
          <button class="node-action-btn connect-btn" title="다른 노드와 연결선 만들기" onclick="event.stopPropagation(); window.app.startConnecting('${node.id}');">🔗</button>
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
      // 연결 모드 중이면 타겟 노드로 지정하여 즉시 연결
      if (window.app && window.app.isConnectingMode) {
        window.app.completeConnecting(node.id);
        return;
      }

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
        if (window.app && window.app.isConnectingMode) return;
        this.selectNode(node.id);
        if (this.onNodeClick) this.onNodeClick(node);
      }
    });

    // 마우스 이벤트 바인딩
    el.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (window.app && window.app.isConnectingMode) {
        window.app.completeConnecting(node.id);
        return;
      }
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
      case 'goal': return 'linear-gradient(90deg, #92400e, #d97706)';
      case 'idea': return 'linear-gradient(90deg, #065f46, #059669)';
      case 'strategy': return 'linear-gradient(90deg, #3730a3, #4f46e5)';
      case 'task': return 'linear-gradient(90deg, #075985, #0284c7)';
      case 'ai': return 'linear-gradient(90deg, #4c1d95, #6b21a8)';
      case 'core': return 'linear-gradient(90deg, #1e3a5f, #1e40af)';
      case 'backend': return 'linear-gradient(90deg, #064e3b, #047857)';
      case 'database': return 'linear-gradient(90deg, #78350f, #92400e)';
      case 'finance': return 'linear-gradient(90deg, #713f12, #854d0e)';
      default: return 'linear-gradient(90deg, #1e293b, #334155)';
    }
  }

  // 3D 네온 튜브 연결선 (3D Curved Pipeline) & 라벨 & 실시간 파티클 구축
  build3DEdges() {
    // 1. 기존 지오메트리 & 메시 정리
    while (this.edgeGroup.children.length > 0) {
      const child = this.edgeGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.edgeGroup.remove(child);
    }

    // 2. 기존 CSS3D 엣지 라벨 제거
    if (this.edgeLabels) {
      this.edgeLabels.forEach(obj => this.scene.remove(obj));
    }
    this.edgeLabels = [];
    this.edgeParticles = [];

    const particleGeo = new THREE.SphereGeometry(3.6, 8, 8);

    this.edges.forEach((edge, edgeIdx) => {
      const fromNode = this.nodeMap.get(edge.from);
      const toNode = this.nodeMap.get(edge.to);
      if (!fromNode || !toNode) return;

      const p1 = new THREE.Vector3(fromNode.x + fromNode.width, fromNode.y + fromNode.height / 2, fromNode.z || 0);
      const p2 = new THREE.Vector3(toNode.x, toNode.y + toNode.height / 2, toNode.z || 0);

      // 3D 베지어 곡선 생성
      const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const zDiff = Math.abs(p2.z - p1.z);
      midPoint.z += Math.max(zDiff * 0.35, 120);

      const curve = new THREE.QuadraticBezierCurve3(p1, midPoint, p2);
      const tubeRadius = edge.style === 'solid' ? 2.8 : 2.0;
      const tubeGeo = new THREE.TubeGeometry(curve, 36, tubeRadius, 8, false);
      
      const edgeColorHex = edge.color ? parseInt(edge.color.replace('#', '0x')) : 0x38bdf8;
      const tubeMat = new THREE.MeshStandardMaterial({
        color: edgeColorHex,
        emissive: edgeColorHex,
        emissiveIntensity: 0.65,
        roughness: 0.2,
        metalness: 0.8,
        wireframe: edge.style === 'dashed'
      });

      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      this.edgeGroup.add(tubeMesh);

      // 3. 3D 네온 라벨 배지 생성 (곡선 중간점)
      const labelText = edge.label || '파이프라인 연결';
      const labelEl = document.createElement('div');
      labelEl.className = 'edge-3d-badge';
      labelEl.innerHTML = `<span class="edge-icon">⚡</span><span>${labelText}</span>`;
      labelEl.title = `클릭 시 연결 정보 및 라벨 수정 (${labelText})`;
      labelEl.onclick = (e) => {
        e.stopPropagation();
        if (window.app) window.app.openEdgeEditModalFor(edge.id);
      };

      const labelObj = new THREE.CSS3DObject(labelEl);
      const labelPos = curve.getPointAt(0.5);
      labelObj.position.copy(labelPos);
      labelObj.position.z += 28; // 튜브 바로 위에 배치
      this.scene.add(labelObj);
      this.edgeLabels.push(labelObj);

      // 4. 실시간 데이터 플로우 파티클 생성 (2개의 빛나는 광자 볼)
      for (let i = 0; i < 2; i++) {
        const pMat = new THREE.MeshBasicMaterial({
          color: 0xffffff
        });
        const pMesh = new THREE.Mesh(particleGeo, pMat);
        this.edgeGroup.add(pMesh);

        this.edgeParticles.push({
          mesh: pMesh,
          curve: curve,
          speed: 0.18 + (edgeIdx % 3) * 0.05,
          offset: i * 0.5
        });
      }
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

    // ⚡ 실시간 데이터 플로우 파티클 애니메이션
    if (this.realtimeSimulationActive && this.edgeParticles && this.edgeParticles.length > 0) {
      const now = Date.now() * 0.001;
      for (let i = 0; i < this.edgeParticles.length; i++) {
        const p = this.edgeParticles[i];
        const t = (now * p.speed + p.offset) % 1;
        const pos = p.curve.getPointAt(t);
        p.mesh.position.copy(pos);
      }
    }

    this.webglRenderer.render(this.scene, this.camera);
    this.cssRenderer.render(this.scene, this.camera);

    this.renderRadar();
  }
}
