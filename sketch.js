// p5.js + 아두이노 웹 시리얼 전시 스케치

// --- [추가 및 수정 상수 정의] ---
const SECOND_SCREEN_DELAY = 2000;
const BUBBLE_SPAWN_INTERVAL = 1200; // 시간차를 더 늘려 차례대로 하나씩 등장하게 함 (1200ms)
const BUBBLE_CLASSIFY_DURATION = 60; // 분류 판정 칩 노출 시간 (프레임 단위, 60프레임 = 약 1초)
const SCREEN_MARGIN_Y = 200;       // 위아래 마진을 200px로 확대하여 부유 영역 고정
const BUBBLE_START_X = 0.75;
const BUBBLE_START_Y = 0.20;       // 물방울 발사 시작 높이를 더 위쪽으로 수정 (20% Y)
const FIST_THRESHOLD = 0.12;

const SECOND_BUBBLE_SIZE = 400;
const SECOND_BUBBLE_MIN_SPEED = 5.5; // 기존 4.0에서 속도 약간 추가 상향
const SECOND_BUBBLE_DAMPING = 0.99;  // 기존 0.98에서 감속률을 줄여 속도 유지
const BUBBLE_X_SLANT = -80; // 버블 인덱스에 따라 X축으로 비스듬히 배치되는 값

const ASSETS = {
    background2: "assets/background2.png",
    video: {
        opening: "assets/video/part1_stage0_opening.mp4"
    },
    audio: {
        stage12BubbleSpawn: "assets/audio/part1/part1_stage1_2_bubble_spawn.mp3",
        stage12BubbleDischargeSuction: "assets/audio/part1/part1_stage1_2_bubble_discharge_suction.mp3",
        stage1Machine01: "assets/audio/part1/part1_stage1_machine_01.mp3",
        stage1Machine02: "assets/audio/part1/part1_stage1_machine_02.mp3",
        stage1Machine03: "assets/audio/part1/part1_stage1_machine_03.mp3",
        stage1BubbleEnterInlet: "assets/audio/part1/part1_stage1_bubble_enter_inlet.mp3",
        stage1BubbleSuction: "assets/audio/part1/part1_stage1_bubble_suction.mp3",
        stage1SuctionDeviceAppear: "assets/audio/part1/part1_stage1_suction_device_appear.mp3",
        stage1Usable: "assets/audio/part1/part1_stage1_usable.mp3",
        stage1Unusable: "assets/audio/part1/part1_stage1_unusable.mp3",
        stage1DisposalReason: "assets/audio/part1/part1_stage1_disposal_reason.mp3",
        stage1BottomMessage: "assets/audio/part1/part1_stage1_bottom_message.mp3",
        stage1Bgm: "assets/audio/part1/part1_stage1_bgm.mp3",
        stage2Bgm: "assets/audio/part1/part1_stage2_bgm.mp3",
        bubblePop: "assets/audio/shared/shared_bubble_pop.mp3"
    }
};

const APP_STATE = {
    OPENING: "opening",
    SORTING: "sorting",
    DISPOSING: "disposing",
    TRANSITION: "transition",
    SECOND_SCREEN: "secondScreen"
};

let currentAppState = APP_STATE.OPENING;
let openingVideo;
let isVideoStarted = false;

// 사운드 객체 변수
let sndBubbleSpawn, sndDischargeSuction, sndBubbleEnterInlet, sndBubbleSuction, sndSuctionDeviceAppear;
let sndUsable, sndUnusable, sndDisposalReason, sndBottomMessage, sndStage1Bgm, sndStage2Bgm, sndBubblePop;
let currentBgm = null;

function initSounds() {
    sndBubbleSpawn = new Audio(ASSETS.audio.stage12BubbleSpawn);
    sndDischargeSuction = new Audio(ASSETS.audio.stage12BubbleDischargeSuction);
    sndBubbleEnterInlet = new Audio(ASSETS.audio.stage1BubbleEnterInlet);
    sndBubbleSuction = new Audio(ASSETS.audio.stage1BubbleSuction);
    sndSuctionDeviceAppear = new Audio(ASSETS.audio.stage1SuctionDeviceAppear);
    sndUsable = new Audio(ASSETS.audio.stage1Usable);
    sndUnusable = new Audio(ASSETS.audio.stage1Unusable);
    sndDisposalReason = new Audio(ASSETS.audio.stage1DisposalReason);
    sndBottomMessage = new Audio(ASSETS.audio.stage1BottomMessage);

    sndStage1Bgm = new Audio(ASSETS.audio.stage1Bgm);
    sndStage1Bgm.loop = true;

    sndStage2Bgm = new Audio(ASSETS.audio.stage2Bgm);
    sndStage2Bgm.loop = true;

    sndBubblePop = new Audio(ASSETS.audio.bubblePop);

    // --- [효과음 및 배경음 볼륨 조절 설정 (0.0 ~ 1.0)] ---
    sndBubbleSpawn.volume = 0.8;
    sndDischargeSuction.volume = 0.5;
    sndBubbleEnterInlet.volume = 0.5;
    sndBubbleSuction.volume = 0.5;
    sndSuctionDeviceAppear.volume = 0.5;
    sndUsable.volume = 0.5;
    sndUnusable.volume = 0.5;
    sndDisposalReason.volume = 0.5;
    sndBottomMessage.volume = 0.5;
    sndStage1Bgm.volume = 0.2; // BGM은 효과음 대비 작게 설정
    sndStage2Bgm.volume = 0.2;
    sndBubblePop.volume = 0.6;
}

function playSound(audioNode) {
    if (!audioNode) return;
    try {
        let clone = audioNode.cloneNode();
        clone.play().catch(err => console.log("Audio play blocked:", err));
    } catch (e) {
        console.error("playSound error:", e);
    }
}

function playBgm(bgmNode) {
    if (currentBgm === bgmNode) return;
    if (currentBgm) {
        currentBgm.pause();
        currentBgm.currentTime = 0;
    }
    currentBgm = bgmNode;
    if (currentBgm) {
        currentBgm.play().catch(err => console.log("BGM play blocked:", err));
    }
}

function stopBgm() {
    if (currentBgm) {
        currentBgm.pause();
        currentBgm.currentTime = 0;
        currentBgm = null;
    }
}

let background2Img;
let secondScreenStartTime = 0;
let secondScreenBubbles = [];
let transitionTimer = 0;
let fadeAlpha = 0;
let isFadingOut = false;
let wasFistPrev = false;
let popParticles = [];

// --- [엔딩 팝업 시퀀스 관련 상수 및 변수 정의] ---
const PART1_END_POPUP_WIDTH = 1600;      // 팝업 가로 크기
const PART1_END_LOADING_DURATION = 1500; // 로딩 팝업 표시 시간 (ms)
const PART1_END_MSG1_DURATION = 2000;    // 메시지 1 표시 시간 (ms)
const PART1_END_MSG2_DURATION = 1000;    // 메시지 2 표시 시간 (ms)
const PART1_END_MSG3_DURATION = 2000;    // 마지막 메시지 유지 시간 (ms)

// --- [part2_after_pop.png 크기 및 위치 상수] ---
const PART2_AFTER_POP_X = 1080;          // 이미지 중심 X 좌표 (기본값: CANVAS_W / 2 = 1080)
const PART2_AFTER_POP_Y = 1920;          // 이미지 중심 Y 좌표 (기본값: CANVAS_H / 2 = 1920)
const PART2_AFTER_POP_WIDTH = 1600;      // 이미지 가로 크기

let part1EndPopupResultImg;
let part1EndPopupLoadingImg;
let part1EndPopupMsg1Img;
let part1EndPopupMsg2Img;
let part1EndPopupMsg3Img;

let part1EndingActive = false;
let part1EndingStep = 0;
let endingStepTimer = 0;

let part2ActionGuidePopupImg;
let part2AfterPopImg;
let part2ActionGuideActive = false;
let part2ActionGuideTriggered = false;

let disposalVideo;

// 캔버스 및 스폰(생성) 관련 상수
const CANVAS_W = 2160;
const CANVAS_H = 3840;
const SPAWN_X = CANVAS_W / 2 + 25;
const SPAWN_Y = 705;
const SPAWN_SIZE = 500;

// 폰트 크기 관련 상수 (기본 대기 물방울용과 떨어지는 물방울용 각각 설정)
const SPAWN_AI_FONT_SIZE = 54;
const SPAWN_HUMAN_FONT_SIZE = 40;
const DROP_AI_FONT_SIZE = 54;
const DROP_HUMAN_FONT_SIZE = 40;

// 상태 칩 크기 및 위치 조정 상수
const STATUS_CHIP_SCALE = 0.85;   // 물방울 크기 대비 상태 칩 가로 비율 (예: 0.70 = 70%)
const STATUS_CHIP_X_OFFSET = -28;   // 상태 칩 가로 위치 오프셋 (양수: 오른쪽, 음수: 왼쪽)
const STATUS_CHIP_Y_OFFSET = 703;  // 물방울 상단 경계선 기준 Y축 오프셋 (양수: 물방울과 겹침, 음수: 물방울 위에 떠 있음)

// 상태 라이트(Status Light) 크기 및 위치 조정 상수 (유저가 나중에 조정하기 쉽도록 절대 좌표 설정)
const STATUS_LIGHT_W = 110;        // 상태 라이트 이미지 가로 크기
const STATUS_LIGHT_AI_X = 500;     // AI 상태 라이트 X 좌표 (캔버스 절대 좌표)
const STATUS_LIGHT_AI_Y = 1200;    // AI 상태 라이트 Y 좌표 (캔버스 절대 좌표)
const STATUS_LIGHT_HUMAN_X = 1550;  // Human 상태 라이트 X 좌표 (캔버스 절대 좌표)
const STATUS_LIGHT_HUMAN_Y = 1200;  // Human 상태 라이트 Y 좌표 (캔버스 절대 좌표)

// 카운터 텍스트(Counter Text) 크기 및 위치 조정 상수 (유저가 나중에 조정하기 쉽도록 절대 좌표 설정)
const COUNTER_TEXT_SIZE = 85;      // 폰트 크기 (45px)
const COUNTER_TEXT_X = 580;        // 카운터 텍스트 X 좌표 (캔버스 절대 좌표)
const COUNTER_TEXT_Y = 560;        // 카운터 텍스트 Y 좌표 (캔버스 절대 좌표)

// 상태 메시지 UI(Status Message UI) 크기 및 위치 조정 상수 (유저가 나중에 조정하기 쉽도록 절대 좌표 설정)
const STATUS_MSG_X = 1080;         // 상태 메시지 중앙 X 좌표 (캔버스 절대 좌표)
const STATUS_MSG_Y = 3685;         // 상태 메시지 Y 좌표 (캔버스 절대 좌표)
const STATUS_MSG_ICON_W = 64;      // 상태 메시지 아이콘 가로 크기 (36px)
const STATUS_MSG_FONT_SIZE = 64;   // 상태 메시지 폰트 크기 (35px)
const STATUS_MSG_GAP = 28;         // 아이콘과 텍스트 사이의 간격
const STATUS_MSG_STROKE = "#FEF5E1"; // 상태 메시지 외곽선 색상 (외곽선이 필요 없을 경우 생략하거나 두께를 0으로 설정)
const STATUS_MSG_STROKE_W = 0.5;   // 상태 메시지 외곽선 두께 (0이면 외곽선 없음)

// 폐기장 입구 (Disposal Port) 크기 및 위치 조정 상수
const DISPOSAL_PORT_X = 1360;                // 이미지 시작 X 좌표
const DISPOSAL_PORT_WIDTH = 400;             // 이미지 가로 크기
const DISPOSAL_PORT_HEIGHT = 200;            // 이미지 세로 크기
const DISPOSAL_PORT_HIDDEN_Y = 3450;          // 완전히 아래로 숨겨졌을 때 Y 좌표
const DISPOSAL_PORT_VISIBLE_Y = 3300;         // 완전히 위로 노출되었을 때 Y 좌표

// 클리핑 마스크 영역 (disposal_port.png가 이 영역 안에서만 보여야 함)
const DISPOSAL_PORT_MASK_X = 1360;           // 마스크 좌상단 X 좌표
const DISPOSAL_PORT_MASK_Y = 3200;           // 마스크 좌상단 Y 좌표
const DISPOSAL_PORT_MASK_W = 400;            // 마스크 가로폭
const DISPOSAL_PORT_MASK_H = 250;            // 마스크 세로높이

// 애니메이션 프레임 수 (180프레임 = 약 3초 동안 천천히 진행)
const DISPOSAL_PORT_ANIMATION_DURATION = 180;

// 분류 영역 정의 (왼쪽 = AI, 오른쪽 = Human)
const aiZone = {
    x: 200,
    y: 1650,
    w: 850,
    h: 1800
};

const humanZone = {
    x: 1110,
    y: 1650,
    w: 850,
    h: 1800
};

// 폐기사유서 팝업 관련 상수 (기존 대비 약 2.5배 확대 및 동적 배치)
const REASON_POPUP_WIDTH = 800;
const REASON_POPUP_HEIGHT = 350;
const REASON_POPUP_DURATION = 3000;

// 영역 가이드라인 표시 여부 제어
const SHOW_ZONE_GUIDE = false;

// 표시할 텍스트 풀 정의
const aiTexts = [
    "11101101",
    "10010100",
    "10111100",
    '"text": "p.eye"',
    "0101"
];

const humanTexts = [
    { text: '"옛날로 돌아가고 싶어"', reason: "복원 불가능한 시간에 대한 반복적인 접근 감지" },
    { text: "아까의 기분이 아직 남아 있음", reason: "감정 데이터의 유통 기한 초과 및 잔류 허용치 초과" },
    { text: "힘든 기억을 예쁘게 포장하기", reason: "과거 기억에 대한 비정상적인 미화 및 왜곡 필터 감지" },
    { text: '"그렇게 하지 말걸.."', reason: "결정 경로에 대한 무한 후회 루프 및 리소스 낭비" },
    { text: "못 버리고 있는 물건", reason: "폐기 대상 물질에 대한 비합리적인 정서적 집착 감지" }
];

// 에셋 변수
let bgImg;
let bubbleImg;
let galmuriFont;
let statusChipAiImg;
let statusChipHumanImg;
let statusLightAiImg;
let statusLightHumanImg;
let statusMessageIconImg;
let disposalPortImg;
let reasonImg;

// 디버깅용 마우스 클릭 위치 추적 변수
let lastClickX = -1;
let lastClickY = -1;
let lastClickTime = 0;

// Matter.js 관련 에일리어스(축약 변수)
const { Engine, World, Bodies, Body, Composite } = Matter;
let engine;
let world;
let humanFloor;           // Human 영역 바닥 물리 바디 (애니메이션 연동을 위해 전역 변수화)
let initialHumanFloorY;   // Human 영역 바닥의 초기 Y 좌표

// 버블 관리 배열
let currentBubble;       // 상단 대기 지점에 떠 있는 현재 버블
let poppingBubbles = [];  // 현재 pop 애니메이션이 진행 중인 버블들
let physicalBubbles = []; // Matter.js 물리 엔진 상에서 움직이는 버블들
let bubblePool = [];      // 10개 제한 소모성 텍스트 풀
let lastFullySpawnedType = null; // 이전 완전히 생성된 물방울의 타입 (상태 칩 유지용)
let isSequenceActive = false; // 현재 드롭 시퀀스가 진행 중인지 여부
let droppedCount = 0;         // 생성된 물방울 개수 (0 -> 10)
let systemState = "Idle";     // 시스템 상태 ("Idle", "LeverDetected", "SortingAI", "SortingHuman", "SortingFinished", "VacuumStart", "Disposing", "DisposeFinished")
let activePhysicalBubble = null;       // 최근 물리 엔진 월드에 추가되어 떨어지는 중인 버블 바디
let activePhysicalBubbleSettled = false; // 해당 버블이 충돌 후 자리 잡았는지(속도가 감쇄되었는지) 여부
let spawnFrameCount = 0;              // 해당 버블이 물리 월드에 추가된 시점의 frameCount
let activeLightType = null;           // 현재 켜져 있는 상태 라이트의 타입 ("AI", "Human" 또는 꺼짐 상태인 null)

// 폐기장 입구 애니메이션 상태 변수
let isDisposalPortAnimating = false;
let isDisposalPortVisible = false;
let disposalPortAnimProgress = 0.0;
let vacuumStartTimer = 0;       // VacuumStart 상태 진행 프레임 수
let activeSuckingBubble = null;  // 현재 빨려 들어가는 중인 물리 버블 객체
let suctionDelayTimer = 0;      // 다음 버블 흡입까지의 대기 시간 프레임 수

// 시리얼 연결 상태 관련 변수
let serialReader = null;
let serialBuffer = "";

function preload() {
    // 배경 및 버블 이미지 텍스트 로드
    bgImg = loadImage('assets/background.gif');
    background2Img = loadImage(ASSETS.background2);
    bubbleImg = loadImage('assets/bubble.png');
    galmuriFont = loadFont('assets/GalmuriMono11.ttf');
    statusChipAiImg = loadImage('assets/status_chip_available_ai.png');
    statusChipHumanImg = loadImage('assets/status_chip_unavailable_human.png');
    statusLightAiImg = loadImage('assets/status_light_available_ai.png');
    statusLightHumanImg = loadImage('assets/status_light_unavailable_human.png');
    statusMessageIconImg = loadImage('assets/status_message_icon.png');
    disposalPortImg = loadImage('assets/disposal_port.png');
    reasonImg = loadImage('assets/reason.png');

    // 엔딩 팝업 이미지 로드
    part1EndPopupResultImg = loadImage('assets/part1_end_popup_result.png');
    part1EndPopupLoadingImg = loadImage('assets/part1_end_popup_loading.png');
    part1EndPopupMsg1Img = loadImage('assets/part1_end_popup_message_01.png');
    part1EndPopupMsg2Img = loadImage('assets/part1_end_popup_message_02.png');
    part1EndPopupMsg3Img = loadImage('assets/part1_end_popup_message_03.png');

    // 2부 액션 가이드 팝업 이미지 로드
    part2ActionGuidePopupImg = loadImage('assets/part2_action_guide_popup.png');
    part2AfterPopImg = loadImage('assets/part2_after_pop.png');

}

function setup() {
    // 사운드 및 오프닝 영상 초기화
    initSounds();
    openingVideo = createVideo([ASSETS.video.opening]);
    openingVideo.hide();

    // webm 형식의 폐기 동영상 로드 (온점 두 개 포함된 파일명)
    disposalVideo = createVideo(['assets/part1_disposal_in_progress..webm']);
    disposalVideo.hide();

    // 전시용 캔버스 생성
    const canvas = createCanvas(CANVAS_W, CANVAS_H);
    canvas.parent('canvas-container');

    // 텍스트 정렬 및 스타일 설정
    textAlign(CENTER, CENTER);
    textFont('Outfit');
    textStyle(BOLD);

    // Matter.js 물리 엔진 초기화
    engine = Engine.create();
    world = engine.world;
    world.gravity.y = 1.6 * 2.5; // 2.5배 빠른 하강을 위해 중력값을 2.5배 높임

    // AI 및 Human 영역의 물리적 경계(벽, 바닥) 생성 (스폰 높이인 1400 부근부터 떨어질 때 탈출하지 않도록 벽을 위로 연장)
    const wallThickness = 60;
    const wallTopY = 1200; // 물리 벽의 상단 Y 좌표
    const wallHeight = (aiZone.y + aiZone.h) - wallTopY; // 3500 - 1200 = 2300px
    const wallCenterY = wallTopY + wallHeight / 2; // 2350px

    // AI 영역 왼쪽 벽
    const aiLeftWall = Bodies.rectangle(
        aiZone.x - wallThickness / 2,
        wallCenterY,
        wallThickness,
        wallHeight,
        { isStatic: true, label: "ai_left_wall" }
    );

    // AI 영역 오른쪽 벽 / Human 영역 왼쪽 벽 (가운데 분할 벽)
    // AI 영역의 우측(1080)과 Human 영역의 좌측(1150) 사이의 70px 틈을 메우는 분할 벽
    const dividerX = (aiZone.x + aiZone.w + humanZone.x) / 2; // 1115px
    const dividerW = humanZone.x - (aiZone.x + aiZone.w); // 70px
    const centerDivider = Bodies.rectangle(
        dividerX,
        wallCenterY,
        dividerW,
        wallHeight,
        { isStatic: true, label: "center_divider" }
    );

    // Human 영역 오른쪽 벽
    const humanRightWall = Bodies.rectangle(
        humanZone.x + humanZone.w + wallThickness / 2,
        wallCenterY,
        wallThickness,
        wallHeight,
        { isStatic: true, label: "human_right_wall" }
    );

    // AI 영역 바닥
    const aiFloor = Bodies.rectangle(
        aiZone.x + aiZone.w / 2,
        aiZone.y + aiZone.h + wallThickness / 2,
        aiZone.w + wallThickness * 2,
        wallThickness,
        { isStatic: true, label: "ai_floor" }
    );

    // Human 영역 바닥
    initialHumanFloorY = humanZone.y + humanZone.h + wallThickness / 2;
    humanFloor = Bodies.rectangle(
        humanZone.x + humanZone.w / 2,
        initialHumanFloorY,
        humanZone.w + wallThickness * 2,
        wallThickness,
        { isStatic: true, label: "human_floor" }
    );

    // 버블이 화면 밖으로 이탈하여 뚫리는 버그 방지용 전체 안전 벽
    const globalLeftWall = Bodies.rectangle(-50, CANVAS_H / 2, 100, CANVAS_H, { isStatic: true });
    const globalRightWall = Bodies.rectangle(CANVAS_W + 50, CANVAS_H / 2, 100, CANVAS_H, { isStatic: true });
    const globalFloor = Bodies.rectangle(CANVAS_W / 2, CANVAS_H + 50, CANVAS_W, 100, { isStatic: true });

    // 생성한 모든 물리 경계들을 물리 월드(World)에 추가
    World.add(world, [
        aiLeftWall, centerDivider, humanRightWall,
        aiFloor, humanFloor,
        globalLeftWall, globalRightWall, globalFloor
    ]);

    // 풀 초기화 (첫 번째 버블은 사용자의 첫 번째 버튼 입력/스페이스바 입력 시 생성되도록 함)
    initializeBubblePool();
    currentBubble = null;
    lastFullySpawnedType = null;
    suctionDelayTimer = 0;
}

function draw() {
    // 오프닝 영상 상태 처리
    if (currentAppState === APP_STATE.OPENING) {
        background(0);
        if (openingVideo) {
            imageMode(CORNER);
            image(openingVideo, 0, 0, CANVAS_W, CANVAS_H);
        }

        if (!isVideoStarted) {
            push();
            noStroke();
            fill(255, 255, 255, 180);
            textAlign(CENTER, CENTER);
            textFont('DNFBitBitv2');
            textSize(70);
            text("TAP TO START", CANVAS_W / 2, CANVAS_H / 2);
            pop();
        }
        return;
    }

    // 1. Matter.js 물리 엔진 업데이트 (프레임 드랍으로 인한 과도한 도약을 막기 위해 최대 가중치 제한)
    if (currentAppState === APP_STATE.SORTING || currentAppState === APP_STATE.DISPOSING || currentAppState === APP_STATE.TRANSITION) {
        Engine.update(engine, Math.min(deltaTime, 30));
    }

    // 2. 배경 이미지 그리기 (TRANSITION 상태가 아닐 때만 개별 그리기, TRANSITION 시에는 scrollTransition에서 통합 처리)
    if (currentAppState !== APP_STATE.TRANSITION) {
        imageMode(CORNER);
        image(bgImg, 0, 0, CANVAS_W, CANVAS_H);
    }

    // --- State-based Rendering & Logic ---
    if (currentAppState === APP_STATE.SORTING || currentAppState === APP_STATE.DISPOSING) {
        // 3. 영역 가이드라인 그리기
        if (SHOW_ZONE_GUIDE && currentAppState === APP_STATE.SORTING) {
            drawZoneGuides();
        }

        // 4. 활강/pop 애니메이션 중인 버블 업데이트 및 처리
        drawPoppingBubbles();

        // 5. 물리 엔진 상의 버블들 그리기
        drawPhysicalBubbles();

        // 5.5 폐기장 입구 그리기
        drawDisposalPort();

        // 6. 상단 대기열의 떠 있는 버블 그리기
        drawCurrentBubble();

        // 7~8.5 오버레이 텍스트 및 UI 그리기
        drawCounterText();
        drawStatusMessage();
        drawReasonPopups();

        // 9. 최근 떨어진 물리 버블이 안정화되었는지 체크하여 상태 업데이트
        checkActiveBubbleSettling();

        // 10. VacuumStart 및 Disposing 흡입 애니메이션 상태 제어
        updateVacuumAbsorption();

        // --- 폐기 진행 중 비디오 오버레이 (화면 전체 채우기) ---
        if (systemState === "VacuumStart" || systemState === "Disposing") {
            if (disposalVideo) {
                imageMode(CORNER);
                image(disposalVideo, 0, 0, CANVAS_W, CANVAS_H);
            }
        }
    } else if (currentAppState === APP_STATE.TRANSITION) {
        // 1단계 -> 2단계 릴스 스타일 수직 스크롤 전환 연출
        handleReelsScrollTransition();
    } else if (currentAppState === APP_STATE.SECOND_SCREEN) {
        // 2번째 화면: human bubble 등장 연출, MediaPipe 인터랙션, 파편 효과, 손 커서
        drawSecondScreenBubbles();
        checkBubbleCollision();
        drawPopParticles();
        drawHandCursor();

        // --- 엔딩 팝업 시퀀스 처리 ---
        if (part1EndingActive) {
            // 배경 dim 처리 (약간 반투명한 검정 오버레이)
            push();
            fill(0, 0, 0, 150);
            noStroke();
            rectMode(CORNER);
            rect(0, 0, CANVAS_W, CANVAS_H);
            pop();

            // 현재 스텝에 맞는 이미지 출력
            if (part1EndingStep < 0) {
                // part2_after_pop.png 시퀀스
                let elapsedForImg = millis() - endingStepTimer;
                let alpha = 255;
                if (part1EndingStep === -3) { // 1초 페이드인
                    alpha = map(elapsedForImg, 0, 1000, 0, 255);
                    alpha = constrain(alpha, 0, 255);
                } else if (part1EndingStep === -2) { // 4초 유지
                    alpha = 255;
                } else if (part1EndingStep === -1) { // 1초 페이드아웃
                    alpha = map(elapsedForImg, 0, 1000, 255, 0);
                    alpha = constrain(alpha, 0, 255);
                }
                
                if (part2AfterPopImg) {
                    push();
                    tint(255, alpha);
                    imageMode(CENTER);
                    let displayW = PART2_AFTER_POP_WIDTH;
                    let displayH = part2AfterPopImg.height * (displayW / part2AfterPopImg.width);
                    image(part2AfterPopImg, PART2_AFTER_POP_X, PART2_AFTER_POP_Y, displayW, displayH);
                    pop();
                }
            } else {
                let currentPopupImg = null;
                if (part1EndingStep === 0) currentPopupImg = part1EndPopupResultImg;
                else if (part1EndingStep === 1) currentPopupImg = part1EndPopupLoadingImg;
                else if (part1EndingStep === 2) currentPopupImg = part1EndPopupMsg1Img;
                else if (part1EndingStep === 3) currentPopupImg = part1EndPopupMsg2Img;
                else if (part1EndingStep === 4) currentPopupImg = part1EndPopupMsg3Img;
    
                if (currentPopupImg) {
                    showEndPopup(currentPopupImg);
                }
            }

            // 시퀀스 자동 전환 타임라인 업데이트
            updateEndingSequenceTimeline();
        }

        // --- 2부 액션 가이드 팝업 처리 ---
        if (part2ActionGuideActive) {
            // 배경 dim 처리 (약간 반투명한 검정 오버레이)
            push();
            fill(0, 0, 0, 150);
            noStroke();
            rectMode(CORNER);
            rect(0, 0, CANVAS_W, CANVAS_H);
            pop();

            // 가이드 이미지 출력
            showEndPopup(part2ActionGuidePopupImg);
        }
    }

    // 11. 개발 디버그용 클릭 위치 시각화 (1초 동안 빨간 원 표시)
    if (millis() - lastClickTime < 1000 && lastClickX > 0) {
        push();
        fill(255, 0, 0, 180);
        noStroke();
        ellipse(lastClickX, lastClickY, 40, 40);
        pop();
    }
}

/**
 * 전체 10개 텍스트(AI 5개, Human 5개)를 섞어서 풀을 만듭니다.
 */
function initializeBubblePool() {
    bubblePool = [];
    for (let t of aiTexts) {
        bubblePool.push({ text: t, type: "AI" });
    }
    for (let item of humanTexts) {
        bubblePool.push({ text: item.text, type: "Human", reason: item.reason });
    }
    bubblePool = shuffle(bubblePool); // p5.js의 shuffle 함수 사용
}

/**
 * 풀에서 다음 버블을 하나 가져옵니다. 다 쓰면 null을 반환합니다.
 */
function getNextBubbleFromPool() {
    if (bubblePool.length === 0) {
        return null;
    }
    const item = bubblePool.pop();
    playSound(sndBubbleSpawn);
    return {
        text: item.text,
        type: item.type,
        reason: item.reason,
        wobbleOffset: random(0, 1000),
        spawnProgress: 0,
        spawnDuration: 30,
        isClassifying: false,
        classifyProgress: 0,
        classifyDuration: BUBBLE_CLASSIFY_DURATION
    };
}

/**
 * 상단 대기 버블의 분류 판정 단계를 시작합니다 (분류 칩 노출).
 */
function triggerBubbleClassify() {
    if (part1EndingActive) return; // 엔딩 시퀀스 중에는 분류 차단
    if (!currentBubble || isSequenceActive) return;
    if (currentBubble.spawnProgress < currentBubble.spawnDuration) return; // 완전히 생성된 후에만 트리거 가능

    isSequenceActive = true;
    currentBubble.isClassifying = true;
    currentBubble.classifyProgress = 0;
    currentBubble.classifyDuration = BUBBLE_CLASSIFY_DURATION;

    // 분류 시점에 상태 라이트를 켜고 판정 결과 칩 보여주기
    activeLightType = currentBubble.type;
    lastFullySpawnedType = currentBubble.type;
}

/**
 * 상단 대기 버블을 축소시키며 아래로 떨어뜨리는 트리거 시퀀스를 시작합니다.
 */
function triggerBubbleDrop() {
    if (part1EndingActive) return; // 엔딩 시퀀스 중에는 드롭 차단
    if (!currentBubble) return;

    currentBubble.isClassifying = false;
    currentBubble.isShrinking = true;
    currentBubble.shrinkProgress = 0;
    currentBubble.shrinkDuration = 25; // 25프레임 동안 축소 애니메이션 진행

    // 물방울 드롭 카운트 증가 (0 -> 10)
    droppedCount++;

    // 시스템 상태 업데이트 및 흡입 유도 사운드 재생
    systemState = "LeverDetected";
    playSound(sndBubbleEnterInlet);
}

/**
 * 축소 완료된 버블을 화면 아래에서 서서히 생성하며 떨어뜨리는 단계로 진입합니다.
 */
function startDropPhase(shrunkBubble) {
    const isAI = shrunkBubble.type === "AI";
    const newPopBubble = {
        text: shrunkBubble.text,
        type: shrunkBubble.type,
        reason: shrunkBubble.reason,
        startX: CANVAS_W / 2,
        startY: 1550,
        // 각 영역의 가로 중심 위치로 대각선 하강
        targetX: isAI ? (aiZone.x + aiZone.w / 2) : (humanZone.x + humanZone.w / 2),
        targetY: 1800, // 물리 바디가 생성되어 낙하하기 시작하는 목표 Y 좌표
        x: CANVAS_W / 2,
        y: 1550,
        size: 0,
        progress: 0,
        // 2.5배 빠른 하강을 위해 프레임 수를 2.5로 나눔 (AI 45 -> 18, Human 90 -> 36)
        maxFrames: isAI ? 18 : 36,
        wobbleOffset: shrunkBubble.wobbleOffset || random(0, 1000),
        isFromSequence: true
    };

    poppingBubbles.push(newPopBubble);

    // 시스템 상태 업데이트 (분류 중)
    systemState = shrunkBubble.type === "AI" ? "SortingAI" : "SortingHuman";
}

/**
 * 상단에 둥둥 떠 있는 대기 버블을 숨쉬는 듯한 스케일과 위아래 흔들림으로 그립니다.
 */
function drawCurrentBubble() {
    // 1. 버블 본체 그리기 (currentBubble이 존재할 때만)
    if (currentBubble) {
        let currentSize;
        let currentY = SPAWN_Y;

        if (currentBubble.isShrinking) {
            if (currentBubble.shrinkProgress < currentBubble.shrinkDuration) {
                currentBubble.shrinkProgress++;
            }
            const pct = currentBubble.shrinkProgress / currentBubble.shrinkDuration;
            const easePct = pct * pct; // easeInQuad (가속도가 붙어 쏙 빠지는 느낌)
            currentSize = SPAWN_SIZE * (1 - easePct);

            // 축소되면서 아래로 150px 이동
            currentY += easePct * 150;

            // 축소 완료 시 아래로 낙하 시작
            if (currentBubble.shrinkProgress >= currentBubble.shrinkDuration) {
                startDropPhase(currentBubble);
                currentBubble = null;
            }
        } else if (currentBubble.isClassifying) {
            if (currentBubble.classifyProgress < currentBubble.classifyDuration) {
                currentBubble.classifyProgress++;
            }
            currentSize = SPAWN_SIZE; // 풀 사이즈 유지

            // 분류 판정 칩 노출 완료 후 드롭(축소) 시퀀스 시작
            if (currentBubble.classifyProgress >= currentBubble.classifyDuration) {
                triggerBubbleDrop();
            }
        } else {
            // 생성 애니메이션 진행
            if (currentBubble.spawnProgress < currentBubble.spawnDuration) {
                currentBubble.spawnProgress++;
            }
            const pct = currentBubble.spawnProgress / currentBubble.spawnDuration;
            const easePct = 1 - (1 - pct) * (1 - pct); // easeOutQuad
            currentSize = SPAWN_SIZE * easePct;

            // 대기 물방울 생성 완료 후 자동으로 분류 판정 단계 시작
            if (currentBubble.spawnProgress >= currentBubble.spawnDuration && !currentBubble.isClassifying && !currentBubble.isShrinking && !isSequenceActive) {
                triggerBubbleClassify();
            }
        }

        // 축소 완료로 인해 null이 되지 않은 경우에만 버블 그리기
        if (currentBubble) {
            push();
            imageMode(CENTER);
            translate(SPAWN_X, currentY);
            image(bubbleImg, 0, 0, currentSize, currentSize);
            drawBubbleText(currentBubble.text, currentBubble.type, currentSize, true);
            pop();
        }
    }

    // 2. 상단 상태 칩 그리기 (분류가 시작되어 lastFullySpawnedType이 설정되었을 때만 표시하며, 상태 라이트가 켜져 있을 때만 함께 켜짐)
    push();
    translate(SPAWN_X, SPAWN_Y);
    if (lastFullySpawnedType && activeLightType) {
        drawStatusChip({ type: lastFullySpawnedType }, SPAWN_SIZE);
    }
    pop();

    // 3. 상단 상태 라이트 그리기 (캔버스 절대 좌표 기준)
    // 레버를 당긴 후에만 해당 버블 타입에 맞춰 라이트가 켜지고, 정착 후 다시 대기 상태(Idle)가 되면 꺼집니다.
    if (activeLightType) {
        drawStatusLight(activeLightType);
    }
}

/**
 * 버블들의 pop 애니메이션을 관리하고, 완료 시 Matter.js 물리 객체로 변환시킵니다.
 */
function drawPoppingBubbles() {
    for (let i = poppingBubbles.length - 1; i >= 0; i--) {
        const pb = poppingBubbles[i];
        pb.progress++;

        const pct = pb.progress / pb.maxFrames;

        // 끊김 없이 부드럽게 감속하는 sine ease-in-out 이징 곡선 적용
        const easePct = 0.5 * (1.0 - cos(pct * PI));

        // 크기가 0에서 400px로 커지며 아래로 떨어짐
        pb.size = map(easePct, 0, 1.0, 0, 400, true);

        // 하강할 때 좌우로 살짝 흔들리는 S자 곡선 sway 효과 구현
        const swayDirection = pb.type === "AI" ? -1 : 1;
        const swayOffset = sin(pct * PI * 2) * 50 * swayDirection;
        pb.x = map(easePct, 0, 1.0, pb.startX, pb.targetX, true) + swayOffset;

        // Y 위치는 1400에서 1650으로 하강
        pb.y = map(easePct, 0, 1.0, pb.startY, pb.targetY, true);

        if (pb.progress >= pb.maxFrames) {
            // Matter.js 물리 바디로 변환
            spawnMatterBubble(pb);
            poppingBubbles.splice(i, 1);

            // 시퀀스로 생성된 버블 낙하 시작 시, 자동으로 다음 대기 물방울을 생성하지 않고 시퀀스를 비활성화합니다.
            if (pb.isFromSequence) {
                isSequenceActive = false;
            }
        } else {
            // 미세한 비눗방울 뽀잉뽀잉 수축/팽창 비율 계산
            const wobbleTime = frameCount * 0.15 + pb.wobbleOffset;
            const wobbleX = 1.0 + sin(wobbleTime) * 0.04;
            const wobbleY = 1.0 - sin(wobbleTime) * 0.04;

            // 흔들림 방향에 맞춰 시각적 기울기 적용
            const tiltAngle = cos(pct * PI * 2) * 0.15 * swayDirection;

            // 애니메이션 진행 중인 버블 그리기
            push();
            imageMode(CENTER);
            translate(pb.x, pb.y);
            rotate(tiltAngle);
            image(bubbleImg, 0, 0, pb.size * wobbleX, pb.size * wobbleY);

            // 버블 텍스트 렌더링 (false 전달: 떨어지는 물방울용 폰트 설정 사용)
            drawBubbleText(pb.text, pb.type, pb.size, false);
            pop();
        }
    }
}

/**
 * Matter.js 원형 바디를 생성하고 대상 영역을 향해 발사(낙하)합니다.
 */
function spawnMatterBubble(pb) {
    const radius = 220; // 사이즈 400px이므로 반지름은 200

    // AI는 약간 느려지게(기존 0.005 -> 0.02), Human은 빠르게(기존 0.08 -> 0.035) 물리 성질 다르게 지정
    let restitutionVal, frictionAirVal, densityVal;

    if (pb.type === "AI") {
        restitutionVal = 0.25; // 탄성을 살짝 낮춤
        frictionAirVal = 0.08; // 공기 저항을 높여 약간 속도를 늦춤 (기존 0.02에서 상향)
        densityVal = 0.002;
    } else {
        restitutionVal = 0.30;  // 탄성을 낮추고
        frictionAirVal = 0.28;  // 공기 저항을 대폭 높여 천천히 몽실몽실 떨어지게 만듦 (기존 0.45에서 살짝 하향)
        densityVal = 0.0003;    // 밀도를 가볍게 설정
    }

    // Matter.js 원형 바디 인스턴스 생성 (충돌 탈출 방지를 위해 반지름에 마찰 보정)
    const body = Bodies.circle(pb.x, pb.y, radius - 5, {
        restitution: restitutionVal,
        friction: 0.15,
        frictionAir: frictionAirVal,
        density: densityVal
    });

    World.add(world, body);

    // 1.3배 빠른 하강을 위한 초기 수직 속도 설정 (AI 4.5 * 1.3 = 5.85, Human 1.0 * 1.3 = 1.3)
    const velY = pb.type === "AI" ? 5.85 : 1.3;
    Body.setVelocity(body, { x: 0, y: velY });

    // 렌더링에 필요한 메타데이터 정보를 물리 버블 리스트에 추가 (흔들림 관련 진폭 추가)
    physicalBubbles.push({
        body: body,
        text: pb.text,
        type: pb.type,
        reason: pb.reason,
        radius: radius,
        wobbleOffset: pb.wobbleOffset || random(0, 1000),
        wobbleAmp: 1.0 // 뽀잉뽀잉 흔들림 진폭 (낙하가 끝나 멈추면 0으로 부드럽게 감쇄)
    });

    // 최근 추가된 물리 버블 트래킹 설정
    activePhysicalBubble = body;
    activePhysicalBubbleSettled = false;
    spawnFrameCount = frameCount;
}

/**
 * 물리 엔진 시뮬레이션에 있는 모든 버블들을 화면에 그립니다. (바닥에 쌓인 버블 포함)
 */
function drawPhysicalBubbles() {
    for (let i = physicalBubbles.length - 1; i >= 0; i--) {
        const pb = physicalBubbles[i];
        const pos = pb.body.position;
        const angle = pb.body.angle;

        if (pb.scale === undefined) pb.scale = 1.0;

        // 성능 최적화: 비정상적으로 튕기거나 화면 밖으로 벗어난 버블은 물리 월드와 목록에서 삭제
        if (pos.y > CANVAS_H + 500) {
            World.remove(world, pb.body);
            physicalBubbles.splice(i, 1);
            continue;
        }

        // AI 버블과 Human 버블의 최고 하강 속도를 2.5배 제어 (Human 1.8 * 2.5 = 4.5, AI 4.5 * 2.5 = 11.25)
        if (pb.type === "Human" && pb.body.velocity.y > 4.5) {
            Body.setVelocity(pb.body, { x: pb.body.velocity.x, y: 4.5 });
        } else if (pb.type === "AI" && pb.body.velocity.y > 11.25) {
            Body.setVelocity(pb.body, { x: pb.body.velocity.x, y: 11.25 });
        }

        // 낙하 중일 때와 멈췄을 때의 뽀잉뽀잉/흔들림 진폭 제어 (안정적인 적재를 위해)
        const isFalling = pb.body.velocity.y > 0.8;
        if (pb.wobbleAmp === undefined) pb.wobbleAmp = 1.0;

        if (isFalling) {
            pb.wobbleAmp = lerp(pb.wobbleAmp, 1.0, 0.08);

            // 수평 흔들림 물리 힘 적용 (비눗방울이 드리프트하듯 흔들리게 함)
            const forceTime = frameCount * 0.05 + pb.wobbleOffset;
            const swayForce = sin(forceTime) * 0.00035;
            Body.applyForce(pb.body, pb.body.position, { x: swayForce, y: 0 });
        } else {
            pb.wobbleAmp = lerp(pb.wobbleAmp, 0.0, 0.15); // 쌓여서 안착하면 흔들림을 빠르게 0으로 감쇄
        }

        // VacuumStart 상태에서 Human 버블들을 둥실둥실 위로 떠오르게 힘 적용 (중력 0.0016*mass를 극복하도록 힘 조절)
        if (systemState === "VacuumStart" && pb.type === "Human") {
            const floatForceY = -0.0019 * pb.body.mass;
            const swayForceX = sin(frameCount * 0.04 + pb.wobbleOffset) * 0.0002 * pb.body.mass;
            Body.applyForce(pb.body, pb.body.position, { x: swayForceX, y: floatForceY });
        }

        const forceTime = frameCount * 0.05 + pb.wobbleOffset;
        const wobbleTime = frameCount * 0.18 + pb.wobbleOffset;

        // 뽀잉뽀잉 수축/팽창 비율 계산
        const wobbleX = 1.0 + sin(wobbleTime) * 0.035 * pb.wobbleAmp;
        const wobbleY = 1.0 - sin(wobbleTime) * 0.035 * pb.wobbleAmp;

        // 회전 각도 계산 (물리 회전각 + 시각적 흔들림 기울기)
        const renderAngle = angle + (cos(forceTime) * 0.12 * pb.wobbleAmp);

        // Human 버블 폐기 사유서 자동 팝업 생성 및 소멸 처리 (1/4 지점 하강 시 자동 팝업 -> 땅에 착지하여 멈추면 사라짐)
        if (pb.type === "Human") {
            const quarterY = humanZone.y + humanZone.h / 4; // humanZone 1/4 지점 (약 Y=2025)

            // 1. 1/4 지점 떨어졌을 때 자동으로 팝업 띄우기
            if (!pb.hasTriggeredReason && pos.y >= quarterY) {
                pb.hasTriggeredReason = true;
                pb.isAutoTriggered = true;
                triggerReasonPopup(pb);
            }

            // 2. 땅에 닿아서 더 이상 안 움직이면(속도가 0.25 미만으로 감소) 사라지게 처리
            if (pb.showReason && pb.isAutoTriggered) {
                const isSettled = pos.y > 2400 && pb.body.speed < 0.25 && (frameCount - (pb.reasonTriggerFrame || 0) > 15);
                if (isSettled) {
                    pb.showReason = false;
                    pb.isAutoTriggered = false;
                }
            }

            // 3. 수동 클릭으로 띄운 경우 타임아웃 처리
            if (pb.showReason && pb.isManualClick) {
                if (millis() - pb.reasonStartTime > REASON_POPUP_DURATION) {
                    pb.showReason = false;
                    pb.isManualClick = false;
                }
            }
        }

        push();
        imageMode(CENTER);
        translate(pos.x, pos.y);
        rotate(renderAngle); // 물리 회전각과 visual 흔들림이 더해진 각도로 회전

        // 버블 렌더링 (물리 바디 반지름인 200px 기반으로 400px 크기에 뽀잉뽀잉 효과 적용)
        const displayW = pb.radius * 2 * wobbleX * pb.scale;
        const displayH = pb.radius * 2 * wobbleY * pb.scale;
        image(bubbleImg, 0, 0, displayW, displayH);

        // 버블 위 텍스트 렌더링 (false 전달: 떨어지는 물방울용 폰트 설정 사용)
        drawBubbleText(pb.text, pb.type, pb.radius * 2 * pb.scale, false);
        pop();

    }
}

/**
 * 지정한 Human 버블의 폐기사유서 팝업을 활성화하고 물방울의 '왼쪽'으로만 배치되도록 오프셋을 계산합니다.
 */
function triggerReasonPopup(bubble) {
    bubble.showReason = true;
    bubble.reasonStartTime = millis();
    bubble.reasonTriggerFrame = frameCount;
    playSound(sndDisposalReason);

    const pos = bubble.body.position;
    const W = REASON_POPUP_WIDTH;
    const H = REASON_POPUP_HEIGHT;
    const margin = 30;
    const r = bubble.radius;

    // 폐기사유서 팝업은 무조건 물방울의 좌측에 위치시킴
    let chosenX = pos.x - r - W - margin;
    let chosenY = pos.y - H / 2;

    const safetyPadding = 30;
    chosenX = constrain(chosenX, safetyPadding, pos.x - r - W - margin);
    chosenY = constrain(chosenY, safetyPadding, CANVAS_H - H - safetyPadding);

    bubble.popupOffsetX = chosenX - pos.x;
    bubble.popupOffsetY = chosenY - pos.y;
}

/**
 * 활성화된 모든 Human 버블의 폐기사유서 팝업을 화면 최상위 레이어에 렌더링합니다.
 */
function drawReasonPopups() {
    physicalBubbles.forEach(pb => {
        if (pb.type === "Human" && pb.showReason && pb.suctionProgress === undefined) {
            const pos = pb.body.position;
            push();
            imageMode(CORNER);

            // 버블 위치에 맞게 사전에 계산된 동적 오프셋 적용 및 캔버스 화면 이탈 방지 constrain (무조건 물방울 왼쪽에 뜨도록 함)
            const rawX = pos.x + (pb.popupOffsetX !== undefined ? pb.popupOffsetX : (-REASON_POPUP_WIDTH - 80));
            const rawY = pos.y + (pb.popupOffsetY !== undefined ? pb.popupOffsetY : -REASON_POPUP_HEIGHT / 2);

            const popupX = constrain(rawX, 30, pos.x - pb.radius - REASON_POPUP_WIDTH - 10);
            const popupY = constrain(rawY, 30, CANVAS_H - REASON_POPUP_HEIGHT - 30);

            image(reasonImg, popupX, popupY, REASON_POPUP_WIDTH, REASON_POPUP_HEIGHT);

            // 텍스트 설정
            textFont(galmuriFont);
            textStyle(NORMAL);
            textSize(45); // 2.5배 크기에 맞춘 폰트 사이즈
            textLeading(60);
            fill("#634982");
            noStroke();
            textAlign(CENTER, CENTER);
            rectMode(CORNER);

            const paddingX = 60; // 2.5배 크기에 맞춘 패딩
            const paddingTop = 90; // 상단 "폐기사유서" 타이틀 영역 침범 방지용 패딩
            const paddingBottom = 40;
            text(
                pb.reason || "",
                popupX + paddingX,
                popupY + paddingTop,
                REASON_POPUP_WIDTH - (paddingX * 2),
                REASON_POPUP_HEIGHT - paddingTop - paddingBottom
            );
            pop();
        }
    });
}

/**
 * 영역 확인용 네온 가이드라인(AI 및 Human 존)을 캔버스에 그립니다.
 */
function drawZoneGuides() {
    push();
    noFill();
    strokeWeight(4);

    // 1. AI 영역 가이드라인 (청록색 네온 테마)
    stroke(0, 229, 255, 120);
    rect(aiZone.x, aiZone.y, aiZone.w, aiZone.h, 24);

    // 네온 텍스트 라벨
    fill(0, 229, 255, 160);
    noStroke();
    textSize(42);
    textAlign(CENTER, TOP);
    text("AI CLASSIFIED ZONE", aiZone.x + aiZone.w / 2, aiZone.y + 40);

    // 2. Human 영역 가이드라인 (자홍색 네온 테마)
    noFill();
    strokeWeight(4);
    stroke(255, 0, 165, 120);
    rect(humanZone.x, humanZone.y, humanZone.w, humanZone.h, 24);

    // 네온 텍스트 라벨
    fill(255, 0, 165, 160);
    noStroke();
    textSize(42);
    textAlign(CENTER, TOP);
    text("HUMAN CLASSIFIED ZONE", humanZone.x + humanZone.w / 2, humanZone.y + 40);

    pop();
}

/**
 * 웹 시리얼 연결을 초기화합니다 (HTML 연결 버튼 클릭으로 실행).
 */
async function initSerialConnection() {
    if (!navigator.serial) {
        alert("Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.");
        return null;
    }

    try {
        // 사용자가 선택할 시리얼 포트 요청
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });

        // 연결 완료 후 버튼 UI 업데이트
        const btn = document.getElementById("serial-btn");
        if (btn) {
            btn.innerText = "CONNECTED";
            btn.classList.add("connected");
        }

        const debugIndicator = document.getElementById("status-indicator");
        if (debugIndicator) {
            debugIndicator.innerText = "SERIAL CONFIGURED (9600 BAUD)";
        }

        // 스트림 바이트를 UTF-8 문자열로 디코딩하기 위한 디코더 스트림 설정
        const textDecoder = new TextDecoderStream();
        port.readable.pipeTo(textDecoder.writable);
        serialReader = textDecoder.readable.getReader();

        // 백그라운드에서 실행될 시리얼 수신 루프 실행
        readSerialLoop();

        return serialReader;
    } catch (err) {
        console.error("Web Serial connection failed:", err);
        alert("Arduino connection error. See console details.");
        return null;
    }
}

/**
 * 아두이노 장치로부터 수신된 시리얼 데이터를 파싱하는 백그라운드 루프입니다.
 */
async function readSerialLoop() {
    try {
        while (serialReader) {
            const { value, done } = await serialReader.read();
            if (done) {
                break;
            }
            if (value) {
                serialBuffer += value;
                // 버퍼 데이터를 개행 문자로 나눔
                let lines = serialBuffer.split(/\r?\n/);
                serialBuffer = lines.pop(); // 완전하지 않은 마지막 라인은 다음 수신 데이터를 위해 버퍼에 유지

                for (let line of lines) {
                    line = line.trim();
                    if (line === "PULL" || line === "1") {
                        handleUserInputTrigger();
                    }
                }
            }
        }
    } catch (err) {
        console.error("Serial connection read error:", err);

        // 오류 발생 시 버튼 UI 복원
        const btn = document.getElementById("serial-btn");
        if (btn) {
            btn.innerText = "CONNECT ARDUINO";
            btn.classList.remove("connected");
        }
    }
}

/**
 * 키보드 입력(Spacebar 등) 또는 시리얼 PULL 신호를 처리하는 통합 핸들러입니다.
 */
function handleUserInputTrigger() {
    if (part2ActionGuideActive) {
        part2ActionGuideActive = false;
        console.log("Part 2 Action Guide: Dismissed by user trigger.");
        return;
    }

    if (part1EndingActive) {
        if (part1EndingStep === 0) {
            part1EndingStep = 1;
            endingStepTimer = millis();
            console.log("Ending Sequence: User trigger detected, starting loading (Step 1)");
        }
        return;
    }

    if (currentAppState === APP_STATE.OPENING) {
        if (!isVideoStarted && openingVideo) {
            openingVideo.play();
            openingVideo.onended(() => {
                currentAppState = APP_STATE.SORTING;
                playBgm(sndStage1Bgm);
            });
            isVideoStarted = true;
        }
        return;
    }

    if (currentAppState === APP_STATE.SORTING) {
        // 이미 대기 물방울이 있거나, 드롭 시퀀스가 진행 중이거나, 낙하 애니메이션 진행 중이거나,
        // 물리 버블 중 최근 버블이 아직 정착되지 않았거나, 흡입 연출 중이면 무시함
        if (currentBubble || isSequenceActive || poppingBubbles.length > 0 || (activePhysicalBubble && !activePhysicalBubbleSettled) || systemState === "VacuumStart" || systemState === "Disposing" || systemState === "SortingFinished") {
            return;
        }

        // 새 물방울 생성
        currentBubble = getNextBubbleFromPool();
        if (currentBubble) {
            // 판정 칩을 처음에는 숨기기 위해 null로 리셋
            lastFullySpawnedType = null;
        }
    }
}

/**
 * 개발용 키보드 입력을 처리합니다 (Spacebar).
 */
function keyPressed() {
    if (key === ' ' || key === 'Enter') {
        handleUserInputTrigger();
        return;
    }

    // 개발 테스트용 'P' 키 처리 (10개 즉시 분류 완료 스킵 단축키)
    if (key === 'p' || key === 'P') {
        skipToFinished();
    }

    // 바로 2부(인간 버블 화면)로 넘어가는 'O' 키 단축키 처리
    if (key === 'o' || key === 'O') {
        transitionToSecondScreen();
        currentAppState = APP_STATE.SECOND_SCREEN;
        secondScreenStartTime = millis();
    }
}

/**
 * 마우스 클릭 시 Human 물방울을 감지하여 폐기사유서 팝업을 띄웁니다.
 * p5.js 내장 mouseX, mouseY는 CSS 스케일링이 적용된 상태에서도 원래 해상도(2160x3840) 좌표로 자동 변환됩니다.
 */
function mousePressed() {
    if (part2ActionGuideActive) {
        part2ActionGuideActive = false;
        console.log("Part 2 Action Guide: Dismissed by mouse click.");
        return;
    }

    if (part1EndingActive) {
        if (part1EndingStep === 0) {
            part1EndingStep = 1;
            endingStepTimer = millis();
            console.log("Ending Sequence: Mouse click detected, starting loading (Step 1)");
        }
        return; // 엔딩 시퀀스 활성화 시 다른 마우스 클릭 무시
    }

    // 오프닝 비디오 시작 처리
    if (currentAppState === APP_STATE.OPENING) {
        if (!isVideoStarted && openingVideo) {
            openingVideo.play();
            openingVideo.onended(() => {
                currentAppState = APP_STATE.SORTING;
                playBgm(sndStage1Bgm);
            });
            isVideoStarted = true;
        }
        return;
    }

    const mx = mouseX;
    const my = mouseY;

    // 디버그용 클릭 위치 기록
    lastClickX = mx;
    lastClickY = my;
    lastClickTime = millis();

    console.log(`[Click Debug] mouseX=${mx.toFixed(1)}, mouseY=${my.toFixed(1)}`);

    physicalBubbles.forEach((bubble, idx) => {
        if (bubble.type === "Human") {
            const pos = bubble.body.position;
            const d = dist(mx, my, pos.x, pos.y);
            console.log(`  Bubble #${idx} "${bubble.text}": pos=(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}), dist=${d.toFixed(1)}, radius=${bubble.radius}`);
            if (d < bubble.radius) {
                bubble.isManualClick = true;
                triggerReasonPopup(bubble);
            }
        }
    });
}

/**
 * 개발 디버깅용으로 10개 물방울을 모두 즉시 스폰하고 분류 완료 상태로 건너뜁니다.
 */
function skipToFinished() {
    // 1. 진행 중이던 대기/낙하 애니메이션 버블 초기화
    poppingBubbles = [];
    currentBubble = null;
    isSequenceActive = false;
    suctionDelayTimer = 0;

    // 2. 바닥 물리 경계선이 올라간 상태라면 원위치로 초기화
    if (humanFloor && initialHumanFloorY !== undefined) {
        Body.setPosition(humanFloor, { x: humanFloor.position.x, y: initialHumanFloorY });
    }

    // 3. bubblePool에 남아있는 모든 텍스트를 물리 월드에 즉시 스폰
    while (bubblePool.length > 0) {
        const item = bubblePool.pop();
        const isAI = item.type === "AI";

        // 각 분류 영역 안에 자연스럽게 떨어져서 안착되도록 랜덤 좌표 설정
        const targetX = isAI ? random(aiZone.x + 150, aiZone.x + aiZone.w - 150) : random(humanZone.x + 150, humanZone.x + humanZone.w - 150);
        const targetY = random(2000, 3200);

        const radius = 220;
        let restitutionVal = isAI ? 0.25 : 0.45;
        let frictionAirVal = isAI ? 0.02 : 0.035;
        let densityVal = isAI ? 0.002 : 0.0006;

        const body = Bodies.circle(targetX, targetY, radius - 5, {
            restitution: restitutionVal,
            friction: 0.15,
            frictionAir: frictionAirVal,
            density: densityVal
        });

        World.add(world, body);

        physicalBubbles.push({
            body: body,
            text: item.text,
            type: item.type,
            reason: item.reason,
            radius: radius,
            wobbleOffset: random(0, 1000),
            wobbleAmp: 0.0,
            hasTriggeredReason: true
        });
    }

    // 4. 드롭 개수를 10개로 고정
    droppedCount = 10;

    // 5. 상태 라이트 끄고 분류 완료 및 폐기장 슬라이드 애니메이션 즉시 트리거
    activeLightType = null;
    systemState = "SortingFinished";
    isDisposalPortAnimating = true;
    isDisposalPortVisible = true;
    disposalPortAnimProgress = 0.0;
    playSound(sndDischargeSuction);
}

/**
 * 물방울 타입에 따른 상태 칩 이미지를 가져옵니다.
 */
function updateStatusChip(bubbleType) {
    if (bubbleType === "AI") {
        return statusChipAiImg;
    } else {
        return statusChipHumanImg;
    }
}

/**
 * 물방울의 상단 중앙에 상태 칩을 렌더링합니다.
 */
function drawStatusChip(bubble, size) {
    const chipImg = updateStatusChip(bubble.type);
    if (!chipImg) return;

    // 물방울 크기에 비례하여 칩 너비 결정
    const chipW = size * STATUS_CHIP_SCALE;
    const chipH = (chipImg.height / chipImg.width) * chipW;

    imageMode(CENTER);
    // 물방울 상단 중앙에 위치하도록 Y 오프셋 조정
    const scale = size / 400.0;
    const yOffset = -size / 2 - chipH / 2 + STATUS_CHIP_Y_OFFSET * scale;
    const xOffset = STATUS_CHIP_X_OFFSET * scale;
    image(chipImg, xOffset, yOffset, chipW, chipH);
}

/**
 * 버블 타입에 따라 해당하는 상태 라이트 이미지를 그립니다.
 * 유저가 좌표를 나중에 손쉽게 수정할 수 있도록 절대 좌표 상수를 활용합니다.
 */
function drawStatusLight(bubbleType) {
    if (bubbleType === "AI") {
        if (statusLightAiImg) {
            imageMode(CORNER);
            image(statusLightAiImg, STATUS_LIGHT_AI_X, STATUS_LIGHT_AI_Y, STATUS_LIGHT_W, statusLightAiImg.height * (STATUS_LIGHT_W / statusLightAiImg.width));
        }
    } else if (bubbleType === "Human") {
        if (statusLightHumanImg) {
            imageMode(CORNER);
            image(statusLightHumanImg, STATUS_LIGHT_HUMAN_X, STATUS_LIGHT_HUMAN_Y, STATUS_LIGHT_W, statusLightHumanImg.height * (STATUS_LIGHT_W / statusLightHumanImg.width));
        }
    }
}

/**
 * 생성된 물방울 개수(0 -> 10)를 나타내는 카운터 텍스트를 그립니다.
 * 유저가 좌표와 크기를 나중에 손쉽게 수정할 수 있도록 절대 좌표 상수를 활용합니다.
 */
function drawCounterText() {
    push();
    textFont('Pixelify Sans');
    textSize(COUNTER_TEXT_SIZE);

    // 텍스트 스타일 설정 (Fill: #45341D, Stroke: #FFE9C0, Stroke Width: 3px)
    fill('#45341D');
    stroke('#FFE9C0');
    strokeWeight(12);
    textAlign(RIGHT, CENTER); // 오른쪽 정렬하여 '/10' 앞에 맞추기 용이하게 함

    // 카운터 숫자 그리기
    text(droppedCount, COUNTER_TEXT_X, COUNTER_TEXT_Y);
    pop();
}

function updateLeverMessage() {
    let prevMsg = leverMessage;
    switch (systemState) {
        case "Idle":
            leverMessage = "버튼을 눌러주세요";
            break;
        case "LeverDetected":
            leverMessage = "인식완료";
            break;
        case "SortingAI":
            leverMessage = "분류중입니다..";
            break;
        case "SortingHuman":
            leverMessage = "분류중입니다.. 물방울을 손으로 터치해보세요.";
            break;
        case "SortingFinished":
            leverMessage = "분류가 완료되었습니다.";
            break;
        case "VacuumStart":
            leverMessage = "사용불가 물방울을 폐기장으로 흡수합니다.";
            break;
        case "Disposing":
            leverMessage = "폐기중입니다..";
            break;
        case "DisposeFinished":
            leverMessage = "폐기가 완료되었습니다. 작동을 종료합니다.";
            break;
        default:
            leverMessage = "";
            break;
    }

    if (leverMessage !== prevMsg && leverMessage !== "") {
        playSound(sndBottomMessage);
    }
}

let leverMessage = "버튼을 눌러주세요";

/**
 * 화면 하단에 상태 메시지 UI (아이콘 및 DNFBitBitv2 폰트 텍스트)를 렌더링합니다.
 */
function drawStatusMessage() {
    updateLeverMessage();
    let msgText = leverMessage;

    if (!msgText || !statusMessageIconImg) return;

    push();
    textFont('DNFBitBitv2');
    textSize(STATUS_MSG_FONT_SIZE);

    // 글자 간격 설정 (6%)
    const letterSpacingPx = STATUS_MSG_FONT_SIZE * 0.06;
    drawingContext.letterSpacing = letterSpacingPx + "px";

    const txtW = textWidth(msgText);
    const totalW = STATUS_MSG_ICON_W + STATUS_MSG_GAP + txtW;
    const startX = STATUS_MSG_X - totalW / 2;
    const textX = startX + STATUS_MSG_ICON_W + STATUS_MSG_GAP;

    // 아이콘 그리기
    const iconH = (statusMessageIconImg.height / statusMessageIconImg.width) * STATUS_MSG_ICON_W;
    imageMode(CORNER);
    image(statusMessageIconImg, startX, STATUS_MSG_Y - iconH / 2, STATUS_MSG_ICON_W, iconH);

    // 텍스트 그리기
    textAlign(LEFT, CENTER);
    noStroke();
    fill('#5E5544');
    text(msgText, textX, STATUS_MSG_Y);

    if (STATUS_MSG_STROKE_W > 0) {
        push();
        drawingContext.save();
        drawingContext.globalCompositeOperation = 'source-atop';
        stroke(STATUS_MSG_STROKE);
        strokeWeight(STATUS_MSG_STROKE_W * 2);
        noFill();
        text(msgText, textX, STATUS_MSG_Y);
        drawingContext.restore();
        pop();
    }

    // 글자 간격 설정 초기화
    drawingContext.letterSpacing = "normal";
    pop();
}

/**
 * 최근 떨어뜨린 버블이 충돌 후 완전히 제자리에 자리 잡았는지 확인하여 2초 후에 상태를 갱신합니다.
 */
function checkActiveBubbleSettling() {
    if ((systemState === "SortingAI" || systemState === "SortingHuman") && activePhysicalBubble && !activePhysicalBubbleSettled) {
        // 물리 월드에 추가되고 30프레임이 경과한 후에만 속도/위치 감지 시작 (스폰 순간 정지 처리 오감지 방지)
        if (frameCount - spawnFrameCount > 30) {
            let pos = activePhysicalBubble.position;
            // Y 좌표가 2700px 이상이거나(거의 다 내려옴), 속도가 0.2 미만이거나, 스폰된 지 600프레임(약 10초)이 경과했을 때 안착으로 간주
            if (pos.y >= 2700 || activePhysicalBubble.speed < 0.2 || (frameCount - spawnFrameCount > 600)) {
                activePhysicalBubbleSettled = true;

                // 분류 결과 사운드 재생
                if (activePhysicalBubble.type === "AI") {
                    playSound(sndUsable);
                } else {
                    playSound(sndUnusable);
                }

                // 거의 떨어진 시점으로부터 1초 뒤에 상태를 'Idle' 또는 완료로 변경
                setTimeout(() => {
                    // 상태 라이트 끄기
                    activeLightType = null;

                    if (droppedCount === 10) {
                        systemState = "SortingFinished";
                        // 폐기장 입구 등장 애니메이션 시작 트리거
                        isDisposalPortAnimating = true;
                        isDisposalPortVisible = true;
                        disposalPortAnimProgress = 0.0;
                        playSound(sndDischargeSuction);
                    } else {
                        systemState = "Idle";
                    }
                }, 1000);
            }
        }
    }
}

/**
 * 폐기장 입구를 그리는 렌더링 함수입니다. 클리핑 마스크(mask) 영역 내부에서 
 * 위로 올라오는 애니메이션이 진행되며, 애니메이션이 끝나면 VacuumStart 상태로 진입합니다.
 */
function drawDisposalPort() {
    if (!isDisposalPortVisible) return;

    if (isDisposalPortAnimating) {
        disposalPortAnimProgress += 1.0 / DISPOSAL_PORT_ANIMATION_DURATION;
        if (disposalPortAnimProgress >= 1.0) {
            disposalPortAnimProgress = 1.0;
            isDisposalPortAnimating = false;

            // 애니메이션이 완료되면 VacuumStart 상태로 전환하고 타이머 초기화
            systemState = "VacuumStart";
            vacuumStartTimer = 0;
            currentAppState = APP_STATE.DISPOSING;
            playSound(sndSuctionDeviceAppear);

            // webm 형식의 폐기 동영상 루프 재생 시작
            if (disposalVideo) {
                disposalVideo.loop();
                disposalVideo.play();
            }
        }
    }

    if (!disposalPortImg) return;

    push();
    // Sine Ease-Out 이징 적용
    let easePct = sin(disposalPortAnimProgress * HALF_PI);
    let curY = map(easePct, 0, 1.0, DISPOSAL_PORT_HIDDEN_Y, DISPOSAL_PORT_VISIBLE_Y, true);

    // 폐기장 상승에 맞추어 Human 바닥(humanFloor)을 220px 위로 상승시킴 (밀려 올라가는 연출 극대화)
    let container_offset = easePct * 220;
    if (humanFloor && initialHumanFloorY !== undefined) {
        Body.setPosition(humanFloor, { x: humanFloor.position.x, y: initialHumanFloorY - container_offset });
    }

    // 9개 매개변수 기반의 정밀 수학적 이미지 크롭(Cropping)으로 클리핑 마스크 구현
    const maskTop = DISPOSAL_PORT_MASK_Y;
    const maskBottom = DISPOSAL_PORT_MASK_Y + DISPOSAL_PORT_MASK_H;
    const imgTop = curY;
    const imgBottom = curY + DISPOSAL_PORT_HEIGHT;

    const intersectTop = max(imgTop, maskTop);
    const intersectBottom = min(imgBottom, maskBottom);

    if (intersectTop < intersectBottom) {
        const dy = intersectTop;
        const dHeight = intersectBottom - intersectTop;
        const dx = DISPOSAL_PORT_X;
        const dWidth = DISPOSAL_PORT_WIDTH;

        // 이미지 소스 상의 Y축 크롭 위치 및 높이 계산
        const relativeTop = intersectTop - imgTop;
        const sx = 0;
        const sy = (relativeTop / DISPOSAL_PORT_HEIGHT) * disposalPortImg.height;
        const sWidth = disposalPortImg.width;
        const sHeight = (dHeight / DISPOSAL_PORT_HEIGHT) * disposalPortImg.height;

        imageMode(CORNER);
        image(disposalPortImg, dx, dy, dWidth, dHeight, sx, sy, sWidth, sHeight);
    }
    pop();
}

/**
 * 버블 내부에 GalmuriMono11 폰트로 설정에 맞게 텍스트를 렌더링합니다.
 */
function drawBubbleText(bubbleText, bubbleType, size, isSpawn = false) {
    push();
    let baseFontSize;
    if (isSpawn) {
        baseFontSize = bubbleType === "AI" ? SPAWN_AI_FONT_SIZE : SPAWN_HUMAN_FONT_SIZE;
    } else {
        baseFontSize = bubbleType === "AI" ? DROP_AI_FONT_SIZE : DROP_HUMAN_FONT_SIZE;
    }
    const scale = size / 360.0;
    const fs = baseFontSize * scale;

    textFont(galmuriFont);
    textStyle(NORMAL);
    textSize(fs);
    textLeading(fs * 1.50);
    fill('#141414');
    noStroke();
    textAlign(CENTER, CENTER);
    rectMode(CENTER);

    const textBoxW = size * 0.70;
    const yOffset = -5 * scale;
    text(bubbleText, 0, yOffset, textBoxW, textBoxW);
    pop();
}

/**
 * VacuumStart 및 Disposing 상태의 타임라인 및 순차적 흡입 애니메이션을 총괄 업데이트합니다.
 */
function updateVacuumAbsorption() {
    if (systemState === "VacuumStart") {
        vacuumStartTimer++;
        // 6초 경과 시 (1초에 60프레임 기준 360프레임) Disposing으로 전환 (기존 4초에서 2초 더 늘림)
        if (vacuumStartTimer >= 360) {
            systemState = "Disposing";
            activeSuckingBubble = null;
        }
    } else if (systemState === "Disposing") {
        // 현재 빨려 들어가고 있는 활성 버블이 없는 경우 새로운 버블 선택
        if (!activeSuckingBubble) {
            let maxValY = -1;
            let lowestBubble = null;

            // 1초(60프레임) 대기 시간 제어
            if (suctionDelayTimer > 0) {
                suctionDelayTimer--;
            } else {
                // 아직 흡입이 시작되지 않은 Human 버블 중 가장 아랫쪽에 위치한 버블(가장 큰 Y 좌표) 검색
                for (let pb of physicalBubbles) {
                    if (pb.type === "Human" && pb.suctionProgress === undefined) {
                        if (pb.body.position.y > maxValY) {
                            maxValY = pb.body.position.y;
                            lowestBubble = pb;
                        }
                    }
                }

                if (lowestBubble) {
                    activeSuckingBubble = lowestBubble;
                    activeSuckingBubble.suctionProgress = 0.0;
                    activeSuckingBubble.startX = lowestBubble.body.position.x;
                    activeSuckingBubble.startY = lowestBubble.body.position.y;
                    activeSuckingBubble.startScale = 1.0;
                    activeSuckingBubble.currentPhysicalScale = 1.0; // 물리 스케일 추적용 변수 초기화

                    // 흡입을 위해 물리 엔진 충돌은 유지하되 움직임은 수동 제어하도록 static 설정
                    Body.setStatic(activeSuckingBubble.body, true);
                } else {
                    // 더 이상 흡입할 Human 버블이 존재하지 않으면 완성!
                    systemState = "DisposeFinished";
                    completeDisposal();
                }
            }
        }

        // 현재 흡입 중인 버블의 애니메이션 진행
        if (activeSuckingBubble) {
            activeSuckingBubble.suctionProgress += 0.025; // Snappy 40프레임 (약 0.66초) 동안 흡입

            if (activeSuckingBubble.suctionProgress >= 1.0) {
                activeSuckingBubble.suctionProgress = 1.0;

                playSound(sndBubbleSuction);

                // 물리 엔진 월드 및 목록에서 삭제
                World.remove(world, activeSuckingBubble.body);
                let idx = physicalBubbles.indexOf(activeSuckingBubble);
                if (idx !== -1) {
                    physicalBubbles.splice(idx, 1);
                }
                activeSuckingBubble = null; // 다음 버블 처리를 위해 비움
                suctionDelayTimer = 60;     // 다음 버블 흡입 시작 전 1초(60프레임) 대기 시간 설정
            } else {
                let progress = activeSuckingBubble.suctionProgress;

                // 폐기장 입구 중앙보다 Y축 200px 위로 올린 지점 (X: 1560, Y: 3150)
                let targetX = DISPOSAL_PORT_X + DISPOSAL_PORT_WIDTH / 2;
                let targetY = DISPOSAL_PORT_VISIBLE_Y - 150;

                let scaleVal = 1.0;
                let posPct = 0.0;
                let startScale = 1.0;

                // 2단계 보간 계산 (Pop & Zip 이징)
                if (progress < 0.25) {
                    // 1단계: 부풀어 오르는 구간 (0% ~ 25%) - 1.0에서 1.25까지 팽창
                    let pct = progress / 0.25;
                    scaleVal = startScale + 0.25 * sin(pct * HALF_PI);
                    posPct = 0.04 * sin(pct * HALF_PI);        // 서서히 당겨지기 시작 (4% 거리 이동)

                    // 물리 바디의 크기를 동적으로 확장하여 주변 버블을 부딪치고 밀어내도록 처리
                    if (activeSuckingBubble.currentPhysicalScale !== undefined) {
                        let factor = scaleVal / activeSuckingBubble.currentPhysicalScale;
                        Body.scale(activeSuckingBubble.body, factor, factor);
                        activeSuckingBubble.currentPhysicalScale = scaleVal;
                    }
                } else {
                    // 2단계 진입 시 충돌을 차단하여 벽/바닥 낑김 방지 (고스트 상태로 전환)
                    if (activeSuckingBubble.body.collisionFilter.mask !== 0) {
                        activeSuckingBubble.body.collisionFilter = {
                            group: -1,
                            category: 0,
                            mask: 0
                        };
                    }
                    // 2단계: zipping 가속 수축 구간 (25% ~ 100%) - 1.25에서 0.0으로 쪼그라들며 가속
                    let pct = (progress - 0.25) / 0.75;
                    scaleVal = 1.25 * (1.0 - pct * pct * pct);  // cubic ease-in 수축
                    posPct = 0.04 + 0.96 * (pct * pct);         // quadratic ease-in 가속 흡입
                }

                let curX = lerp(activeSuckingBubble.startX, targetX, posPct);
                let curY = lerp(activeSuckingBubble.startY, targetY, posPct);
                Body.setPosition(activeSuckingBubble.body, { x: curX, y: curY });

                // 텍스트와 버블이 한 몸으로 동시에 쪼그라들도록 scale 적용
                activeSuckingBubble.scale = scaleVal;
            }
        }
    }
}

function completeDisposal() {
    console.log("completeDisposal: starting reels scroll transition to second screen.");
    currentAppState = APP_STATE.TRANSITION;
    transitionTimer = millis();

    // 폐기 동영상 재생 정지
    if (disposalVideo) {
        disposalVideo.stop();
    }
}

function transitionToSecondScreen() {
    bgImg = background2Img;

    // Matter.js cleanup
    physicalBubbles.forEach(pb => {
        World.remove(world, pb.body);
    });
    physicalBubbles = [];

    // Reset first screen objects
    currentBubble = null;
    poppingBubbles = [];
    isSequenceActive = false;

    // Start second screen timeline
    playBgm(sndStage2Bgm);
    spawnHumanBubbles();
    initializeHandTracking(); // 웹캠 및 미디어파이프 초기화 호출
}

function spawnHumanBubbles() {
    secondScreenBubbles = [];

    for (let i = 0; i < humanTexts.length; i++) {
        // 모든 버블이 오른쪽 위 특정 지점에서 생성됨
        let startX = BUBBLE_START_X * CANVAS_W;
        let startY = BUBBLE_START_Y * CANVAS_H;

        // 아래/왼쪽 방향으로 뿅! 하고 튀어 나가도록 각도 조절 (HALF_PI = 아래, PI = 왼쪽)
        let angle = random(HALF_PI - 0.2, PI + 0.2);
        let speed = random(12, 20); // 속도를 높여 시원하게 쏘아지도록 설정

        secondScreenBubbles.push({
            text: humanTexts[i].text,
            x: startX,
            y: startY,
            vx: cos(angle) * speed,
            vy: sin(angle) * speed,
            state: "spawning",
            spawnTimeOffset: i * BUBBLE_SPAWN_INTERVAL,
            scale: 0.0,
            opacity: 1.0,
            hadOpenHandInside: false
        });
    }
}

let hands = null;
let camera = null;
let isHandTrackingInitialized = false;
let isHandPresent = false;
let isFistCurrent = false;
let currentHandX = -1;
let currentHandY = -1;

let trackedHands = [];
let wasFistPrevArray = [false, false];

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
];

function mapLandmark(p) {
    const videoElement = document.getElementById('webcam');
    const videoWidth = videoElement ? (videoElement.videoWidth || 640) : 640;
    const videoHeight = videoElement ? (videoElement.videoHeight || 480) : 480;

    const camAspect = videoWidth / videoHeight;
    const canvasAspect = CANVAS_W / CANVAS_H;

    let xMapped = p.x;
    let yMapped = p.y;

    if (camAspect > canvasAspect) {
        // 카메라 가로 비율이 더 큼: 좌우 영역을 크롭하여 종횡비 일치시킴
        const croppedWidth = canvasAspect / camAspect;
        const startX = 0.5 - croppedWidth / 2;
        xMapped = (p.x - startX) / croppedWidth;
    } else {
        // 카메라 세로 비율이 더 큼 (거의 없음): 상하 영역 크롭
        const croppedHeight = camAspect / canvasAspect;
        const startY = 0.5 - croppedHeight / 2;
        yMapped = (p.y - startY) / croppedHeight;
    }

    // 0 ~ 1 범위로 제한
    xMapped = constrain(xMapped, 0, 1);
    yMapped = constrain(yMapped, 0, 1);

    // 좌우 반전 거울 모드 적용 후 캔버스 픽셀 값으로 반환
    return {
        x: (1.0 - xMapped) * CANVAS_W,
        y: yMapped * CANVAS_H
    };
}

function initializeHandTracking() {
    if (isHandTrackingInitialized) return;
    isHandTrackingInitialized = true;

    const videoElement = document.getElementById('webcam');
    if (!videoElement) {
        console.error("Webcam video element not found!");
        return;
    }

    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2, // 양손 트래킹 활성화
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults((results) => {
        if (currentAppState !== APP_STATE.SECOND_SCREEN) return;

        trackedHands = [];
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            isHandPresent = true;
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];

                // 손 중심 계산 (손목 0, 검지/중지/약지/새끼 손가락 관절 5, 9, 13, 17의 평균 좌표)
                let sumX = 0, sumY = 0;
                const centerIndices = [0, 5, 9, 13, 17];
                centerIndices.forEach(idx => {
                    sumX += landmarks[idx].x;
                    sumY += landmarks[idx].y;
                });
                let centerX = sumX / centerIndices.length;
                let centerY = sumY / centerIndices.length;

                // 왜곡 없는 뷰포트 종횡비 매핑 함수 활용
                let mappedCenter = mapLandmark({ x: centerX, y: centerY });

                // 주먹 감지 판별
                const palmCenter = landmarks[9];
                let distSum = 0;
                const tips = [8, 12, 16, 20];
                tips.forEach(tip => {
                    let dx = landmarks[tip].x - palmCenter.x;
                    let dy = landmarks[tip].y - palmCenter.y;
                    let dz = landmarks[tip].z - palmCenter.z;
                    distSum += Math.sqrt(dx * dx + dy * dy + dz * dz);
                });
                let avgDist = distSum / 4;
                let isFist = avgDist < FIST_THRESHOLD;

                // 손을 쥘수록 (avgDist가 작을수록) 1.0에 가까워지고, 펼수록 (avgDist가 클수록) 0.0에 가까워짐
                let clenchFactor = map(avgDist, 0.22, 0.05, 0.0, 1.0, true);

                trackedHands.push({
                    x: mappedCenter.x,
                    y: mappedCenter.y,
                    isFist: isFist,
                    clenchFactor: clenchFactor,
                    landmarks: landmarks
                });
            }
        } else {
            isHandPresent = false;
        }
    });

    camera = new Camera(videoElement, {
        onFrame: async () => {
            if (currentAppState === APP_STATE.SECOND_SCREEN) {
                await hands.send({ image: videoElement });
            }
        },
        width: 640,
        height: 480
    });

    camera.start().then(() => {
        console.log("Webcam started successfully.");
    }).catch(err => {
        console.error("Webcam failed to start:", err);
    });
}

function checkBubbleCollision() {
    if (part2ActionGuideActive) return; // 가이드 팝업 노출 시 제스처 무시
    if (trackedHands.length === 0) {
        // 화면에 손이 아예 없으면 모든 물방울의 편 손 진입 상태 리셋
        secondScreenBubbles.forEach(bubble => {
            bubble.hadOpenHandInside = false;
        });
        return;
    }

    // 각 물방울별로 손 진입 및 제스처 판정
    secondScreenBubbles.forEach(bubble => {
        if (bubble.state !== "active") {
            bubble.hadOpenHandInside = false;
            return;
        }

        const r = SECOND_BUBBLE_SIZE / 2;
        let isAnyHandInside = false;
        let isAnyOpenHandInside = false;
        let isGrabTriggered = false;

        trackedHands.forEach(hand => {
            const d = dist(hand.x, hand.y, bubble.x, bubble.y);
            if (d < r) {
                isAnyHandInside = true;
                if (!hand.isFist) {
                    isAnyOpenHandInside = true;
                } else if (bubble.hadOpenHandInside) {
                    // 이전에 편 손이 물방울 안에 들어왔었고, 지금 주먹을 쥔 경우 -> 터짐!
                    isGrabTriggered = true;
                }
            }
        });

        if (isGrabTriggered) {
            bubble.state = "squeezing";
            bubble.squeezeStartTime = millis();
            bubble.squeezeDuration = 2000; // 2초 동안 말랑말랑 애니메이션
            bubble.hadOpenHandInside = false; // 리셋
        } else if (isAnyHandInside) {
            // 물방울 안에 손이 존재하고, 그 중 편 손이 하나라도 있다면 hadOpenHandInside 활성화
            if (isAnyOpenHandInside) {
                bubble.hadOpenHandInside = true;
            }
        } else {
            // 손이 물방울 영역 밖으로 나가면 리셋
            bubble.hadOpenHandInside = false;
        }
    });
}

function popHumanBubble(bubble) {
    bubble.state = "popping";
    bubble.popStartTime = millis();
    bubble.popDuration = 350; // 350ms

    playSound(sndBubblePop);
    createPopParticles(bubble.x, bubble.y);
}

function handleReelsScrollTransition() {
    if (currentAppState !== APP_STATE.TRANSITION) return;

    let elapsed = millis() - transitionTimer;
    let pct = elapsed / SECOND_SCREEN_DELAY;
    if (pct > 1.0) pct = 1.0;

    // 부드러운 sine ease-in-out 이징 곡선
    let easePct = 0.5 * (1.0 - cos(pct * PI));
    let scrollY = easePct * CANVAS_H;

    // 1. 1부 화면 내용 (위로 스크롤되어 올라감)
    push();
    translate(0, -scrollY);

    // 1부 배경 그리기
    imageMode(CORNER);
    image(bgImg, 0, 0, CANVAS_W, CANVAS_H);

    // 1부 물리 버블 그리기
    drawPhysicalBubbles();

    // 1부 폐기장 입구 그리기
    drawDisposalPort();

    // 1부 UI 그리기
    drawCounterText();
    drawStatusMessage();
    drawReasonPopups();
    pop();

    // 2. 2부 화면 내용 (아래에서 스크롤되어 올라옴)
    push();
    translate(0, CANVAS_H - scrollY);

    // 2부 배경 그리기
    imageMode(CORNER);
    image(background2Img, 0, 0, CANVAS_W, CANVAS_H);
    pop();

    // 전환 완료 판단
    if (elapsed >= SECOND_SCREEN_DELAY) {
        transitionToSecondScreen();
        currentAppState = APP_STATE.SECOND_SCREEN;
        secondScreenStartTime = millis();
    }
}

function createPopParticles(x, y) {
    const count = 60; // 파사삭 터지는 풍부한 효과를 위해 파티클 수 증가
    for (let i = 0; i < count; i++) {
        // 버블 반경(200px)에 맞추어 버블 전 영역에 고르게 파티클 생성
        let r = random(0, 180);
        let theta = random(TWO_PI);
        let px = x + cos(theta) * r;
        let py = y + sin(theta) * r;

        // 버블 중심으로부터 외곽으로 퍼져나가는 벡터 계산
        let angle = atan2(py - y, px - x);
        if (r === 0) angle = random(TWO_PI);

        let speed = random(2, 10);

        popParticles.push({
            x: px,
            y: py,
            vx: cos(angle) * speed + random(-1.5, 1.5),
            vy: sin(angle) * speed + random(-1.5, 1.5),
            size: random(8, 25),
            alpha: random(220, 255),
            // 흰색, 하늘색, 연분홍빛의 물방울 테마 색상 믹스
            color: random() > 0.5 ? [255, 255, 255] : (random() > 0.5 ? [180, 235, 255] : [255, 220, 240]),
            decay: random(4, 9),
            friction: random(0.94, 0.97)
        });
    }
}

function drawPopParticles() {
    for (let i = popParticles.length - 1; i >= 0; i--) {
        let p = popParticles[i];

        // 공기저항(마찰력)과 미세한 중력 효과 추가
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.vy += 0.08; // 미세한 중력 가속도로 흘러내리는 느낌 부여

        p.x += p.vx;
        p.y += p.vy;

        p.alpha -= p.decay;
        p.size *= 0.96;

        if (p.alpha <= 0 || p.size <= 0.8) {
            popParticles.splice(i, 1);
        } else {
            push();
            noStroke();
            fill(p.color[0], p.color[1], p.color[2], p.alpha);
            ellipse(p.x, p.y, p.size, p.size);
            pop();
        }
    }
}

function drawHandCursor() {
    if (trackedHands.length === 0) return;

    trackedHands.forEach(hand => {
        push();

        // clenchFactor에 따른 스케일 배율 계산 (손을 더 쥘수록 최대 1.6배까지 커짐)
        let clenchFactor = hand.clenchFactor || 0;
        let scaleMult = 1.0 + clenchFactor * 0.6;

        // 1. 손 모양 상태에 따른 메인 포인터 그리기 (물결 효과 적용)
        if (hand.isFist) {
            // 주먹을 쥔 상태 (잡기): 안을 채운 미세 물결형 흰색 원 (2배 크기) + 외부 물결 링
            let baseRadius = ((130 + sin(frameCount * 0.15) * 8) / 2) * scaleMult;

            // 메인 채워진 원
            fill(255, 255, 255, 230);
            noStroke();
            beginShape();
            for (let i = 0; i < 60; i++) {
                let angle = (TWO_PI / 60) * i;
                let wave = sin(angle * 5 + frameCount * 0.15) * (5 * scaleMult);
                let r = baseRadius + wave;
                vertex(hand.x + cos(angle) * r, hand.y + sin(angle) * r);
            }
            endShape(CLOSE);

            // 외부 은은한 맥동 물결 링
            noFill();
            stroke(255, 255, 255, 100);
            strokeWeight(2);
            beginShape();
            for (let i = 0; i < 60; i++) {
                let angle = (TWO_PI / 60) * i;
                let wave = cos(angle * 6 - frameCount * 0.1) * (4 * scaleMult);
                let r = baseRadius + (15 * scaleMult) + wave;
                vertex(hand.x + cos(angle) * r, hand.y + sin(angle) * r);
            }
            endShape(CLOSE);
        } else {
            // 손을 편 상태: 테두리(스트로크)만 있는 물결형 흰색 원 (2배 크기) + 외부 레이더형 물결 링
            let baseRadius = ((140 + sin(frameCount * 0.08) * 10) / 2) * scaleMult;

            // 메인 스트로크 원
            noFill();
            stroke(255, 255, 255, 220);
            strokeWeight(5);
            beginShape();
            for (let i = 0; i < 60; i++) {
                let angle = (TWO_PI / 60) * i;
                let wave = sin(angle * 6 + frameCount * 0.08) * (6 * scaleMult);
                let r = baseRadius + wave;
                vertex(hand.x + cos(angle) * r, hand.y + sin(angle) * r);
            }
            endShape(CLOSE);

            // 외부 은은한 서브 물결 링
            stroke(255, 255, 255, 60);
            strokeWeight(2);
            beginShape();
            for (let i = 0; i < 60; i++) {
                let angle = (TWO_PI / 60) * i;
                let wave = sin(angle * 8 - frameCount * 0.05) * (5 * scaleMult);
                let r = baseRadius + (20 * scaleMult) + wave;
                vertex(hand.x + cos(angle) * r, hand.y + sin(angle) * r);
            }
            endShape(CLOSE);
        }
        pop();

        // 2. 손을 편 상태일 때, 5개 손가락 끝에 미니 원(포인터) 그리기
        if (!hand.isFist && hand.landmarks) {
            push();
            const fingertipIndices = [4, 8, 12, 16, 20]; // 엄지, 검지, 중지, 약지, 새끼
            fingertipIndices.forEach(idx => {
                let pt = mapLandmark(hand.landmarks[idx]);

                // 손끝 미니 원 그리기 (은은하게 맥동하는 미니 원형 추적선)
                let miniSize = 16 + sin(frameCount * 0.15 + idx) * 3;

                // 외곽 스트로크 링
                noFill();
                stroke(255, 255, 255, 180);
                strokeWeight(2.5);
                ellipse(pt.x, pt.y, miniSize, miniSize);

                // 중심의 아주 작은 실선 도트
                fill(255, 255, 255, 220);
                noStroke();
                ellipse(pt.x, pt.y, 6, 6);
            });
            pop();
        }
    });
}

function drawSecondScreenBubbles() {
    let elapsed = millis() - secondScreenStartTime;
    const spawnDuration = 400;

    // 모든 버블이 스폰 완료되었을 때 가이드 팝업을 1회 활성화
    if (!part2ActionGuideTriggered && secondScreenBubbles.length > 0) {
        let allSpawned = secondScreenBubbles.every(b => b.state === "active");
        if (allSpawned) {
            part2ActionGuideActive = true;
            part2ActionGuideTriggered = true;
            console.log("Part 2 Action Guide: All bubbles spawned. Showing guide popup.");
        }
    }

    // 1. 위치 및 상태 업데이트
    secondScreenBubbles.forEach(bubble => {
        if (bubble.state === "popped") return;

        if (bubble.state === "spawning") {
            let t = (elapsed - bubble.spawnTimeOffset) / spawnDuration;
            if (t >= 0) {
                if (bubble.scale === 0.0) {
                    playSound(sndBubbleSpawn);
                }
                if (t >= 1) {
                    bubble.state = "active";
                    bubble.scale = 1.0;
                } else {
                    bubble.scale = getSpawnScale(t);
                    // 생성 진행 중에도 천천히 퍼져나가도록 이동
                    bubble.x += bubble.vx * 0.5;
                    bubble.y += bubble.vy * 0.5;
                }
            } else {
                bubble.scale = 0.0;
            }
        } else if (bubble.state === "active") {
            if (part2ActionGuideActive) {
                // 가이드 팝업 노출 중에는 움직임 정지
                return;
            }
            // 뿅 튀어나온 속도를 서서히 감속시켜 둥둥 떠다니게 함
            bubble.vx *= SECOND_BUBBLE_DAMPING;
            bubble.vy *= SECOND_BUBBLE_DAMPING;

            // 완전히 정지하지 않도록 최소 부유 속도 유지 (기존 1.5 -> SECOND_BUBBLE_MIN_SPEED)
            let currentSpeed = dist(0, 0, bubble.vx, bubble.vy);
            if (currentSpeed < SECOND_BUBBLE_MIN_SPEED) {
                let angle = atan2(bubble.vy, bubble.vx);
                if (currentSpeed === 0) angle = random(0, TWO_PI);
                bubble.vx = cos(angle) * SECOND_BUBBLE_MIN_SPEED;
                bubble.vy = sin(angle) * SECOND_BUBBLE_MIN_SPEED;
            }

            // 둥둥 떠다니는 움직임 업데이트
            bubble.x += bubble.vx;
            bubble.y += bubble.vy;

            // 경계 영역 충돌 판정 (화면 가장자리에서 반사)
            const r = SECOND_BUBBLE_SIZE / 2;
            const marginX = 100;
            const marginY = SCREEN_MARGIN_Y;

            if (bubble.x - r < marginX) {
                bubble.x = marginX + r;
                bubble.vx *= -1;
            } else if (bubble.x + r > CANVAS_W - marginX) {
                bubble.x = CANVAS_W - marginX - r;
                bubble.vx *= -1;
            }

            if (bubble.y - r < marginY) {
                bubble.y = marginY + r;
                bubble.vy *= -1;
            } else if (bubble.y + r > CANVAS_H - marginY) {
                bubble.y = CANVAS_H - marginY - r;
                bubble.vy *= -1;
            }
        } else if (bubble.state === "squeezing") {
            // 움켜쥐었을 때 2초 동안 말랑말랑한 상태를 유지한 후 터짐
            let elapsedSqueeze = millis() - bubble.squeezeStartTime;
            if (elapsedSqueeze >= bubble.squeezeDuration) {
                popHumanBubble(bubble);
            } else {
                bubble.vx *= SECOND_BUBBLE_DAMPING;
                bubble.vy *= SECOND_BUBBLE_DAMPING;

                let currentSpeed = dist(0, 0, bubble.vx, bubble.vy);
                if (currentSpeed < SECOND_BUBBLE_MIN_SPEED) {
                    let angle = atan2(bubble.vy, bubble.vx);
                    if (currentSpeed === 0) angle = random(0, TWO_PI);
                    bubble.vx = cos(angle) * SECOND_BUBBLE_MIN_SPEED;
                    bubble.vy = sin(angle) * SECOND_BUBBLE_MIN_SPEED;
                }

                bubble.x += bubble.vx;
                bubble.y += bubble.vy;

                // 경계 영역 충돌 판정
                const r = SECOND_BUBBLE_SIZE / 2;
                const marginX = 100;
                const marginY = SCREEN_MARGIN_Y;

                if (bubble.x - r < marginX) {
                    bubble.x = marginX + r;
                    bubble.vx *= -1;
                } else if (bubble.x + r > CANVAS_W - marginX) {
                    bubble.x = CANVAS_W - marginX - r;
                    bubble.vx *= -1;
                }

                if (bubble.y - r < marginY) {
                    bubble.y = marginY + r;
                    bubble.vy *= -1;
                } else if (bubble.y + r > CANVAS_H - marginY) {
                    bubble.y = CANVAS_H - marginY - r;
                    bubble.vy *= -1;
                }
            }
        } else if (bubble.state === "popping") {
            let tPop = (millis() - bubble.popStartTime) / bubble.popDuration;
            if (tPop >= 1) {
                bubble.state = "popped";
                bubble.scale = 0.0;
                bubble.opacity = 0.0;
            } else {
                bubble.scale = lerp(1.0, 1.2, tPop);
                bubble.opacity = lerp(1.0, 0.0, tPop);
            }
        }
    });

    // 2. 물방울끼리 겹치지 않게 서로 밀어내기 (충돌 처리)
    resolveBubbleCollisions();

    // 3. 물방울 렌더링
    secondScreenBubbles.forEach(bubble => {
        if (bubble.scale > 0 && bubble.state !== "popped") {
            push();
            imageMode(CENTER);
            translate(bubble.x, bubble.y);

            let renderScale = bubble.scale;
            let wobbleX = 1.0;
            let wobbleY = 1.0;
            if (bubble.state === "active") {
                let wobbleTime = frameCount * 0.15 + (bubble.y * 0.05);
                wobbleX = 1.0 + sin(wobbleTime) * 0.03;
                wobbleY = 1.0 - sin(wobbleTime) * 0.03;
            } else if (bubble.state === "squeezing") {
                // 움켜쥐었을 때 말랑말랑해지는 찌그러짐 애니메이션 (2초 동안 천천히 1회만 스퀴시)
                let elapsedSqueeze = millis() - bubble.squeezeStartTime;
                let progress = elapsedSqueeze / bubble.squeezeDuration; // 0.0 ~ 1.0
                progress = constrain(progress, 0.0, 1.0);

                // 2초 동안 단 1회만 천천히 찌그러지는 단일 주기
                let squishCycle = sin(progress * TWO_PI);
                let amp = 0.18 * sin(progress * PI); // 중간(1초) 즈음에 가장 찌그러짐이 크고 앞뒤로는 부드럽게 감소

                wobbleX = 1.0 + squishCycle * amp;
                wobbleY = 1.0 - squishCycle * amp;

                // 서서히 부풀어 오르다가 터지기 직전에 원래대로 돌아오는 펄스 효과
                let pulse = 1.0 + sin(progress * PI) * 0.12;
                renderScale = bubble.scale * pulse;
            }

            tint(255, bubble.opacity * 255);
            image(bubbleImg, 0, 0, SECOND_BUBBLE_SIZE * wobbleX * renderScale, SECOND_BUBBLE_SIZE * wobbleY * renderScale);

            drawBubbleText(bubble.text, "Human", SECOND_BUBBLE_SIZE * renderScale);
            pop();
        }
    });

    // 4. 모든 버블이 터졌는지 여부 체크하여 엔딩 시퀀스 트리거
    if (secondScreenBubbles.length > 0 && !part1EndingActive) {
        let allPopped = secondScreenBubbles.every(b => b.state === "popped");
        if (allPopped) {
            // 모든 버블이 터진 시점으로부터 0.5초 뒤에 엔딩 시퀀스 시작
            setTimeout(() => {
                if (!part1EndingActive) {
                    startPart1EndingSequence();
                }
            }, 500);
        }
    }
}

function resolveBubbleCollisions() {
    if (part2ActionGuideActive) return;
    for (let i = 0; i < secondScreenBubbles.length; i++) {
        let b1 = secondScreenBubbles[i];
        if (b1.state !== "active" && b1.state !== "spawning") continue;

        for (let j = i + 1; j < secondScreenBubbles.length; j++) {
            let b2 = secondScreenBubbles[j];
            if (b2.state !== "active" && b2.state !== "spawning") continue;

            // 두 물방울 간의 거리 계산
            let dx = b2.x - b1.x;
            let dy = b2.y - b1.y;
            let d = dist(b1.x, b1.y, b2.x, b2.y);

            // 두 물방울의 현재 크기를 감안한 최소 반경 거리
            let r1 = (SECOND_BUBBLE_SIZE * b1.scale) / 2;
            let r2 = (SECOND_BUBBLE_SIZE * b2.scale) / 2;
            let minDistance = r1 + r2;

            if (d < minDistance) {
                // 겹쳐진 정도 계산
                let overlap = minDistance - d;

                if (dx === 0 && dy === 0) {
                    dx = random(-1, 1);
                    dy = random(-1, 1);
                    d = dist(0, 0, dx, dy);
                }

                // 법선 벡터(방향) 계산
                let nx = dx / d;
                let ny = dy / d;

                // 겹침 해소 (반반씩 밀어내어 분리)
                b1.x -= nx * (overlap / 2);
                b1.y -= ny * (overlap / 2);
                b2.x += nx * (overlap / 2);
                b2.y += ny * (overlap / 2);

                // 탄성 충돌 연산 (속도 반사 및 Bouncing 효과)
                let kx = b1.vx - b2.vx;
                let ky = b1.vy - b2.vy;
                let p = (nx * kx + ny * ky); // 상대 속도의 법선 성분

                if (p > 0) {
                    // 서로를 향해 접근 중인 경우에만 튕겨내도록 함
                    b1.vx -= p * nx;
                    b1.vy -= p * ny;
                    b2.vx += p * nx;
                    b2.vy += p * ny;
                }
            }
        }
    }
}

function getSpawnScale(t) {
    if (t < 0.7) {
        let nt = t / 0.7;
        return lerp(0, 1.1, sin(nt * HALF_PI));
    } else {
        let nt = (t - 0.7) / 0.3;
        return lerp(1.1, 1.0, nt);
    }
}

// --- [엔딩 팝업 시퀀스 제어 함수들] ---

/**
 * 1부 엔딩 시퀀스를 시작합니다.
 */
function startPart1EndingSequence() {
    console.log("startPart1EndingSequence: Starting Part 1 Ending Sequence");
    part1EndingActive = true;
    part1EndingStep = -3;
    endingStepTimer = millis();

    // 분류 관련 상태 정리
    activeLightType = null;
}

/**
 * 지정된 팝업 이미지를 화면 중앙에 정렬하여 그립니다.
 */
function showEndPopup(img) {
    if (!img) return;
    push();
    imageMode(CENTER);
    let displayW = PART1_END_POPUP_WIDTH;
    let displayH = img.height * (displayW / img.width);
    image(img, CANVAS_W / 2, CANVAS_H / 2, displayW, displayH);
    pop();
}

/**
 * 시간 경과에 따라 팝업 이미지 상태를 순차적으로 전환합니다.
 */
function updateEndingSequenceTimeline() {
    if (!part1EndingActive) return;

    let elapsed = millis() - endingStepTimer;

    if (part1EndingStep === -3) { // 1초 페이드인
        if (elapsed >= 1000) {
            part1EndingStep = -2;
            endingStepTimer = millis();
        }
    } else if (part1EndingStep === -2) { // 4초 유지
        if (elapsed >= 4000) {
            part1EndingStep = -1;
            endingStepTimer = millis();
        }
    } else if (part1EndingStep === -1) { // 1초 페이드아웃
        if (elapsed >= 1000) {
            part1EndingStep = 0;
            endingStepTimer = millis();
            console.log("Ending Sequence: Switched to Result Popup (Step 0)");
        }
    } else if (part1EndingStep === 1) { // 로딩 팝업
        if (elapsed >= PART1_END_LOADING_DURATION) {
            part1EndingStep = 2;
            endingStepTimer = millis();
            console.log("Ending Sequence: Switched to Message 01 (Step 2)");
        }
    } else if (part1EndingStep === 2) { // 메시지 01 -> 02 (2초 뒤)
        if (elapsed >= PART1_END_MSG1_DURATION) {
            part1EndingStep = 3;
            endingStepTimer = millis();
            console.log("Ending Sequence: Switched to Message 02 (Step 3)");
        }
    } else if (part1EndingStep === 3) { // 메시지 02 -> 03 (1초 뒤)
        if (elapsed >= PART1_END_MSG2_DURATION) {
            part1EndingStep = 4;
            endingStepTimer = millis();
            console.log("Ending Sequence: Switched to Message 03 (Step 4)");
        }
    } else if (part1EndingStep === 4) { // 메시지 03 유지 후 2부 전환
        if (elapsed >= PART1_END_MSG3_DURATION) {
            goToPart2();
        }
    }
}

/**
 * 2부 화면으로 전환합니다.
 */
function goToPart2() {
    console.log("goToPart2: Ending sequence finished. Restarting to Opening.");
    part1EndingActive = false; // 엔딩 시퀀스 플래그 해제
    resetToOpening();
}

/**
 * 게임의 모든 상태를 오프닝 대기 화면 상태로 완전 초기화합니다.
 */
function resetToOpening() {
    console.log("resetToOpening: Resetting game to opening video screen.");

    // 상태 리셋
    currentAppState = APP_STATE.OPENING;
    isVideoStarted = false;
    if (openingVideo) {
        openingVideo.stop();
        openingVideo.show();
    }

    // 변수 리셋
    droppedCount = 0;
    systemState = "Idle";
    activeLightType = null;
    isDisposalPortVisible = false;
    isDisposalPortAnimating = false;
    disposalPortAnimProgress = 0.0;

    // 2부 액션 가이드 변수 리셋
    part2ActionGuideActive = false;
    part2ActionGuideTriggered = false;

    // Matter.js 물리 객체들 정리
    physicalBubbles.forEach(pb => {
        World.remove(world, pb.body);
    });
    physicalBubbles = [];
    currentBubble = null;
    poppingBubbles = [];
    isSequenceActive = false;

    // 2부 버블 및 텍스트 정리
    secondScreenBubbles = [];

    // 버블 풀 재생성
    initializeBubblePool();

    // BGM 정지
    stopBgm();

    // 폐기 동영상 정지
    if (disposalVideo) {
        disposalVideo.stop();
    }
}

