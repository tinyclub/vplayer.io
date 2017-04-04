/* vplayer: ui.js
 *
 * Copyright: (c) 2017 Wu Zhangjin - wuzhangjin@gmail.com
 * License: GPL 2.0
 * Version: 0.1
 */

var vnc_audio = undefined;

// play Stats
var playStats = {
  INIT: 0,
  LOADING: 1,
  RUNNING: 2,
  STOPPED: 3,
  FINISH: 4,
};

var trackStats = {
  INIT: 0,
  DOWN: 1,
  MOVE: 2,
  UP: 3,
}

var vnc_screen = document.getElementById('VNC_screen');
var vnc_canvas = document.getElementById('VNC_canvas');
var vnc_canvas_backup = document.getElementById('VNC_canvas_backup');

var vnc_main = document.getElementById('VNC_main');
var ftime = document.getElementById('current_time');
var ttime = document.getElementById('total_time');

var vnc_records = document.getElementById('VNC_records');
var vnc_status = document.getElementById('VNC_status');

var vnc_default_video = document.getElementById('VNC_default_video');

var play_bar = document.getElementById('VNC_playbar');
var left_play_bar = document.getElementById('left_playbar');
var right_play_bar = document.getElementById('right_playbar');
var middle_play_bar = document.getElementById('middle_playbar');
var track_bar = document.getElementById('trackBar');
var fs_btn = document.getElementById('fsBtn');
var more_btn = document.getElementById('moreBtn');

// preload next slice if less than 10s left
// here assume the net speed is at least 256k/10s = 25.6 k/s, 256k is the biggest slice size (file size / slices)
var avail_timestamp = 15*1000;

var first_load = 1;

var touchable = 0;
// skip drawing if (skipframes - frame_idx) is big
// draw a text to tell users wait instead.
var frames_delta = 200;

var track_bar_stats = trackStats.INIT;
var prev_track_value;

var VNC_frame_data = new Array();
var fname, short_fname, start_time, play_stats, frame_idx_max, frame_data_slices, skipframes, canvas_imgdata;
var frame_info = {'title':'unknown', 'author': 'unknown', 'create': 'unknown', 'time': '00:00:00', 'tags': 'unknown', 'desc': 'unknown'};
var screen_width_input, screen_height_input, screen_width, screen_height, screen_ratio;

var fullscreen = false, fullscreen_input = false;
var start_disabled = false;
var vnc_screen_disabled = 1;
var fullscreen_disabled = 0;

var default_canvas_height = 20;
var prev_canvas_height;

var last_x = 0;
var last_y = 0;

var full_frame_found = 0;
var full_frame_idx = 0;
var full_frame_foffset = 0;

var prev_screen_width = 0;
var prev_screen_height = 0;
var fs_cnt = 0;

var canvas_imgdata = '';
var begin_frame = 0;

var curr_frame_length = 0;
var next_data_slice = 0;
var stopped_by_me = 0;

var prev_uri = "";

var record_dir = "" + DATA_INCLUDE_URI + "recordings/";

prev_canvas_height = default_canvas_height;
vnc_canvas.height = default_canvas_height;
vnc_canvas_backup.height = default_canvas_height;
play_stats = playStats.INIT;
prev_track_value = 0;
prev_play_stats = play_stats;
frame_idx_max = 0;
frame_data_slices = 0;

// Record lists
function show_records() {
  // console.info("show_records");
  stop();
  
  if (has_record_list())
    draw_records();

  vnc_records.style.width = vnc_screen.offsetWidth + 'px';
  if (vnc_screen.offsetHeight > 100)
    vnc_records.style.height = vnc_screen.offsetHeight + 'px';
  else
    vnc_records.style.height = (vnc_screen.innerHeight - play_bar.offsetHeight - 2) + 'px';
  vnc_screen.style.display = "none";
  vnc_records.style.display = "block";
  more_btn.title = "Hide noVNC Sessions";
}

function hide_records() {
  // console.info("hide_records");

  more_btn.title = "Show noVNC Sessions";
  vnc_records.style.display = "none";
  vnc_screen.style.display = "block";
}

function op_records() {
  // console.info("vnc records display " + vnc_records.style.display);
  if (vnc_records.style.display === "block")
    hide_records();
  else
    show_records();
}

function format_time(ms) {
  var s, m, h;

  if (!ms)
    return '00:00:00';

  s = Math.floor(ms / 1000);

  h = Math.floor(s / 3600);
  m = h > 0 ? Math.floor((s - h * 3600)/60) : Math.floor(s / 60);
  s = m > 0 ? Math.floor((s - h * 3600 - m * 60)) : s;

  if (h < 10)
    h = '0' + h;

  if (m < 10)
    m = '0' + m;

  if (s < 10)
    s = '0' + s;

  return h + ":" + m + ":" + s;
}

function draw_frameitem(item, desc, font, align, color, y, x) {
  if (!item)
    return;

  __draw_text(vnc_canvas_backup, desc + item, font, align, color, y, x, 1, 0);
}

function draw_frameinfo(from_height, to_height) {
  var x, y;
  var size = 35;
  var font = size + "px monospace";
  var color = "white";
  var align = "left";
  var offset = size + 10;
  var w = vnc_canvas_backup.width;
  var columns = w / 21.5;

  var desc = '';
  var info = frame_info['desc'];
  var line_width = columns;
  var rows = parseInt(info.length / line_width);
  var len = Math.min(info.length, line_width);

  var desc_font_size = 30;
  var desc_offset = desc_font_size + 6;
  var content_size = 4 * offset + (rows + 1) * desc_offset;
  var container_size = to_height - from_height;
  var length = info.length;
  if (content_size > container_size) {
     rows = parseInt((container_size - 4 * offset - desc_offset) / desc_offset);
     content_size = 4 * offset + (rows + 1) * desc_offset;
     length = rows * line_width + 1;
  }

  x = Math.round((w - len * 18)/2);
  y = Math.round(from_height + (container_size - content_size) / 2);

  for (i = 0; i < length; i += line_width) {
    var from = i;
    var to = Math.min(from + line_width, info.length);
    
    draw_frameitem(info.slice(from, to).replace(/^ /, ""), desc, desc_font_size + 'px monospace', align, '#eee', y, x);
    y += desc_offset;
  }
  draw_frameitem('', '', font, align, color, y, x);
  y += offset;

  var len = 0;
  for (var k in frame_info) {
    if (k === 'title' || k === 'time' || k === 'desc')
      continue;
    length = frame_info[k].length
    if (k === 'tags')
      length += 11
    else if (k === 'create')
      length += 9
    len = Math.max(len, length);
  }

  len = Math.min(columns, len);
  if (w > len * 21)
    x = Math.round((w - (len * 21))/2);
  else
    x = 10;

  for (var k in frame_info) {
    if (k === 'title' || k === 'time' || k === 'desc')
      continue;
    desc = ''
    if (k === 'create')
      desc = 'Create @ '
    if (k === 'tags')
      desc = 'With tags: '

    draw_frameitem(frame_info[k], desc, font, align, color, y, x);
    y += offset;
  }
}

function draw_frame() {
  __draw_bg(vnc_canvas_backup);

  from_height = Math.round(vnc_canvas_backup.height/6);
  __draw_text(vnc_canvas_backup, "[ " + frame_info['title'].substring(0,30) + " ]", "50px monospace", "center", "#ff6666", from_height, 0, 0.8, 1, "white");

  to_height = Math.round(vnc_canvas_backup.height*3.5/4);

  draw_frameinfo(from_height + Math.floor(50 + 50/2), to_height - Math.floor(30/2));

  __draw_text(vnc_canvas_backup, "vplayer.io, powered by http://tinylab.org", "30px monospace", "center", "#00aa00", to_height, 0, 0.8, 1, "white");

  vnc_canvas.style.display = 'none';
  vnc_canvas_backup.style.display = 'block';

  if (fullscreen)
    enter_fullscreen();
}

function __update_stats(iteration, frame_idx) {
  var frame, tmp = frame_idx + 1;

  if (frame_idx > frame_idx_max)
    tmp = frame_idx_max + 1;

  ftime.textContent = format_time(foffset);
  track_bar.style.background = "linear-gradient(to right, #00aa00, #ff6666 " + parseInt(tmp * 120 / (frame_idx_max + 1)) + "%, #ff6666)"

  if ((frame_idx > skipframes) && running())
    track_bar.value = frame_idx;

  if (frame_idx === frame_idx_max || frame_idx == full_frame_idx)
    backup_canvas();

  if (frame_idx < full_frame_idx) {
    vnc_screen_disabled = 1;
    mode = 'fullspeed';
  } else if (frame_idx === full_frame_idx) {
    if (prev_play_stats === playStats.FINISH) {
      mode = 'realtime';
      prev_foffset = full_frame_foffset;
      if (play_stats == playStats.STOPPED)
        restore();
    }
    resume_control();
    vnc_screen_disabled = 0;
  }
}

function update_stats(iteration, frame_idx) {
  if (full_frame_found)
    __update_stats(iteration, frame_idx);
  else
    find_full_frame(iteration, frame_idx);
}

function find_full_frame(iteration, frame_idx) {
  update_screensize();

  if (!(typeof(rfb) !== 'undefined' && rfb._display && vnc_canvas && vnc_canvas.height !== default_canvas_height))
    return;

  if (prev_canvas_height === default_canvas_height) {
    //console.info("draw the welcome page.");
    if (vnc_canvas_backup.width !== vnc_canvas.width) {
      vnc_canvas_backup.width = vnc_canvas.width;
      vnc_canvas_backup.height = vnc_canvas.height;
    }

    vnc_status.textContent = "Draw Cover Frame";
    vnc_status.style.display = 'none';
    play_bar.style.visibility = 'visible';
    draw_frame();

    mode = 'fullspeed';
    prev_canvas_height = vnc_canvas.height;
  }

  var w = vnc_canvas.width;
  var h = vnc_canvas.height;
  var imgdata = vnc_canvas.getContext('2d').getImageData(w-1, h-1, w, h);
  // console.info("w: " + w + " h: " + h + " frame: " + frame_idx + " imgdata: " + imgdata.data[0]);
  if (imgdata.data[0] === 0)
    return;

  stop();

  full_frame_found = 1;
  frame = VNC_frame_data[frame_idx];
  prev_foffset = frame.slice(1, frame.indexOf('{', 1));

  full_frame_foffset = prev_foffset;
  full_frame_idx = frame_idx;
  track_bar.min = frame_idx;
  mode = 'realtime';

  // Play immediately after load the data
  vnc_screen_disabled = 0;
  start_disabled = false;
  track_bar.disabled = false;
  vnc_status.textContent = "Full Frame Found";
}

function running() {
  return (play_stats === playStats.RUNNING)
}

function __exit_fullscreen() {
  if (document.exitFullscreen)
    document.exitFullscreen();
  else if (document.mozCancelFullScreen)
    document.mozCancelFullScreen();
  else if (document.webkitExitFullscreen)
    document.webkitExitFullscreen();
}

function __enter_fullscreen() {
  var element = document.body;
  var enter = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || element.msRequestFullScreen;
  if (enter)
    enter.call(element);
}

function exit_fullscreen() {
  __exit_fullscreen();
  unset_fs();
  fullscreen = 0;
}

function enter_fullscreen() {
  set_fs();
  __enter_fullscreen();
  fullscreen = 1;
}

function full_screen() {
  if (fullscreen) {
    exit_fullscreen();
    prev_screen_width = screen.width;
    prev_screen_height = screen.height;
    fs_btn.textContent = '[+]';
    fs_btn.title = 'Enter Fullscreen';
  } else {
    fs_btn.textContent = '[-]';
    fs_btn.title = 'Exit Fullscreen';
    prev_screen_width = screen.width;
    prev_screen_height = screen.height;
    enter_fullscreen();
  }
}

function check_fullscreen() {
  if (fullscreen_disabled)
    return;

  if (window.outerWidth === screen.width && window.outerHeight === screen.height) {
    if (screen.width >= prev_screen_width && screen.height >= prev_screen_height)
      set_fs();
  } else {
    if (screen.width <= prev_screen_width && screen.height <= prev_screen_height)
      unset_fs();
  }
}

function set_fs() {
  if (!fullscreen_input)
    document.body.style.background = "black";

  vnc_records.style.border ="1px solid #eee";
  vnc_screen.style.border ="1px solid #eee";

  play_bar.style.position = "absolute";

  update_screensize();

  var tmp = Math.round((window.innerWidth - play_bar.offsetWidth)/2);
  play_bar.style.left = tmp + 'px';
  vnc_screen.style.position = 'absolute';
  vnc_screen.style.left = play_bar.style.left;
  vnc_records.style.position = 'absolute';
  vnc_records.style.left = play_bar.style.left;

  tmp = play_bar.offsetHeight + vnc_screen.offsetHeight;

  if (tmp < window.innerHeight && (!fullscreen_input || window.outerWidth === screen.width)) {
    tmp = Math.round((window.innerHeight - tmp)/2);
    play_bar.style.top = tmp + 'px';
    vnc_screen.style.top = tmp + play_bar.offsetHeight + 'px';
  } else {
    play_bar.style.top = '0px';
    vnc_screen.style.top = play_bar.offsetHeight + 'px';
  }
  vnc_records.style.top = vnc_screen.style.top;
}

function unset_fs() {
  document.body.style.background = "none";

  vnc_records.style.border = "none";
  vnc_screen.style.border = "none";
  play_bar.style.position = "relative";
  vnc_screen.style.position = 'relative';
  vnc_records.style.position = 'relative';

  update_screensize();

  play_bar.style.left = 'auto';
  vnc_screen.style.left = 'auto';
  vnc_records.style.left = 'auto';
  play_bar.style.top = 'auto';
  vnc_screen.style.top = 'auto';
  vnc_records.style.top = 'auto';
}

function load_records() {
  // Load supporting scripts
  eval("WebUtil.load_scripts({'playback': ['records.js'],'" + record_dir + "': ['records.js'], });");
}

disconnected = function (rfb, reason) {
  if (reason)
    test_state = 'failed';
}

notification = function (rfb, mesg, level, options) {
  vnc_status.textContent = mesg;
}

function __start() {
  vnc_status.textContent = "Running";

  iteration = 0;
  start_time = (new Date()).getTime();
  //recv_message = rfb.testMode(send_array, VNC_frame_encoding);

  play_stats = playStats.RUNNING;
  ftime.style.color = '#0a0';

  speedup();

  check_load_framedata();

  if (skipframes <= full_frame_idx && full_frame_found && typeof(vnc_audio) !== 'undefined') {
    vnc_audio.skipTo(0);
    vnc_audio.play();
  }

  next_iteration();
}

function stop(str) {
  backup_canvas();
  restore_canvas(str);

  play_stats = playStats.STOPPED;

  vnc_status.textContent = "Stopped";

  if (ftime.style.color !== '#666')
    ftime.style.color = '#666';
  if (typeof(vnc_audio) !== 'undefined')
    vnc_audio.pause();
}

function __stop() {
  mode = 'realtime';
  update_stats(iteration, frame_idx);
  stop();
  resume();
}

function backup_canvas() {
  //console.info("backup canvas");
  if (!(typeof(rfb) !== 'undefined' && rfb && rfb._display))
    return;

  update_screensize();

  canvas_imgdata = vnc_canvas.getContext('2d').getImageData(0, 0, vnc_canvas.width, vnc_canvas.height);
}

function restore_canvas(str) {
  if (!full_frame_found || frame_idx < full_frame_idx || canvas_imgdata === '')
    return;

  vnc_canvas_backup.getContext('2d').putImageData(canvas_imgdata, 0, 0);

  if (str)
    backup_draw_text(str)
}

function __draw_bg(canvas, style, transparent) {
  if (canvas === vnc_canvas_backup)
    ctx = vnc_canvas_backup.getContext('2d');
  else
    ctx = rfb._display.get_context();

  w = canvas.width;
  h = canvas.height;

  if (!style) {
    //var gradient=ctx.createLinearGradient(0, 0, w, 0);
    //gradient.addColorStop("0","#00aa00");
    //gradient.addColorStop("0.6","blue");
    //gradient.addColorStop("1.0","#ff6666");
    //style = gradient;
    style = "#ff6666";
  }

  if (!transparent)
    transparent = 0.8;

  ctx.globalAlpha = transparent;
  ctx.fillStyle = style;
  ctx.fillRect(0, 0, w, h);
}

function __draw_text(canvas, str, font, align, style, y, x, transparent, bg, bg_style) {
  if (canvas === vnc_canvas_backup)
    ctx = vnc_canvas_backup.getContext('2d');
  else
    ctx = rfb._display.get_context();

  w = canvas.width;
  h = canvas.height;

  if (!font)
    font = "50px monospace";

  if (!align)
    align = "center";

  if (!style)
    style = "white";

  var font_height = parseInt(font);

  if (!x)
    x = parseInt(w / 2);

  if (!y)
    var y = parseInt(h / 6);

  if (!transparent)
    transparent = 0.8;

  if (!bg_style) {
    var gradient=ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop("0","#00aa00");
    //gradient.addColorStop("0.6","red");
    gradient.addColorStop("1.0","#ff6666");
  
    bg_style = gradient;
  }

  if (bg !== 0) {
    ctx.globalAlpha = transparent;
    ctx.fillStyle = bg_style;
    ctx.fillRect(0, y - font_height, w, Math.floor(font_height + font_height/2));
  }

  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillStyle = style;
  ctx.globalAlpha = 1;
  ctx.fillText(str, x, y);
}

function draw_text(str, font) {
  __draw_text(vnc_canvas, str, font);
}

function backup_draw_text(str, font) {
  __draw_text(vnc_canvas_backup, str, font);
}

function resume_control() {
  start_disabled = false;
  track_bar.disabled = false;

  if (full_frame_found && (frame_idx >= full_frame_idx) && (frame_idx < frame_idx_max)) {
    vnc_canvas_backup.style.display = 'none';
    vnc_canvas.style.display = 'block';
  }
}

function resume() {
  resume_control();

  skipframes = full_frame_idx;
  track_bar_stats = trackStats.INIT;
  prev_track_value = frame_idx_max;
}

function check_load_timeout() {
  // Must check if really timeout...
  // console.info("***skipframes: " + skipframes + " curr_frame_length: " + curr_frame_length + " frame_idx: " + frame_idx);
  if (VNC_frame_data.length >= skipframes && VNC_frame_data.length > frame_idx)
    return;

  restore_canvas("Loading timeout!");

  var y = Math.round(vnc_canvas_backup.height/2);
  __draw_text(vnc_canvas_backup, "File not found or network speed issue!","30px monospace", "center", "#a00", y, 0, 0.8, 1, "white");

  setTimeout(__finish, 10000);
}

function stop_onload(stage) {
  // console.info("Stopped @stage " + stage + " @frame: " + frame_idx);
  stop_control();
  stop("Loading ...");

  // Need to check if the file is not found or the network speed is too slow.
  // May be possible to get the error info while the file is not found.
  var timeout = 60000;
  setTimeout(check_load_timeout, timeout);
}

function stop_control() {
  start_disabled = true;
  track_bar.disabled = true;

  if (mode === 'realtime' || (mode === 'fullspeed' && skipframes - frame_idx > frames_delta)
    || (full_frame_found && frame_idx < full_frame_idx)) {
    vnc_canvas.style.display = 'none';
    vnc_canvas_backup.style.display = 'block';
  }
}

function speedup() {
  if (skipframes <= frame_idx)
    return;

  mode = 'fullspeed';
  stop_control();
}

function restore() {
  vnc_status.textContent = "Continued";

  speedup();

  play_stats = playStats.RUNNING;
  ftime.style.color = '#0a0';

  check_load_framedata();

  if (mode === 'realtime' && typeof(vnc_audio) !== 'undefined')
    vnc_audio.playPause();

  queue_next_packet();
}

function start(clean, prev_play_stats, speed) {
  hide_records();

  if (clean)
    resume();
  else
    restore_canvas("Fast Forwarding ...");

  if (prev_play_stats)
    stats = prev_play_stats;
  else
    stats = play_stats;

  if (speed === 'fullspeed')
    mode = 'fullspeed';
  else
    mode = 'realtime';

  if (stats !== playStats.RUNNING) {
    if (fullscreen)
      set_fs();

    if (stats === playStats.STOPPED)
      restore();
    else
      __start();
  } else {
    stop();
  }
}

function track_stop(touch, e) {
  if (track_bar.disabled || vnc_screen_disabled)
    return;

  if (touch === 2)
    touchable = 1;

  if (touchable && touch === 1)
    return;

  track_bar_stats = trackStats.DOWN;
  prev_play_stats = play_stats;
  if ((frame_idx < frame_idx_max) && running()) {
    if (typeof(vnc_audio) !== 'undefined')
      vnc_audio.pause();
    stop();
  }

  if (touch) {
    var evt = window.event || e;
    //evt.prevtDefault();
    if (evt.touches) {
      last_x = evt.touches[0].clientX;
      last_y = evt.touches[0].clientY;
    } else {
      last_x = evt.clientX;
      last_y = evt.clientY;
    }
    // console.log("x is " + last_x + " y is " + last_y);
  }

  prev_track_value = Number(track_bar.value);
  // console.log("prev track value is " + prev_track_value);
}

function track_move(touch, e) {
  if (track_bar.disabled || vnc_screen_disabled)
    return;

  if (touch === 2)
    touchable = 1;

  if (touchable && touch === 1)
    return;

  if ((track_bar_stats !== trackStats.DOWN) && (track_bar_stats !== trackStats.MOVE))
    return;

  var moved = 0;
  var offset = 0;

  if (touch) {
    var evt = window.event || e;
    var x_offset, y_offset, x, y;
    if (evt.touches) {
      x = evt.touches[0].clientX;
      y = evt.touches[0].clientY;
    } else {
      x = evt.clientX;
      y = evt.clientY;
    }
  
    x_offset = Math.abs(x - last_x);
    y_offset = Math.abs(y - last_y);
    if ((x_offset > y_offset) && (x_offset > 5)) {
      moved = 1;
      offset = Math.round((x - last_x) * track_bar.max / track_bar.offsetWidth);
      // console.log("x is " + x + " y is " + y + " moved is " + moved);
      last_x = x;
      last_y = y;
    }
  }

  if (prev_track_value !== Number(track_bar.value))
    moved = 1;

  //console.log("cur track value is " + Number(track_bar.value));

  if ((track_bar_stats !== trackStats.MOVE) && (moved)) {
    start_disabled = true;
    track_bar_stats = trackStats.MOVE;
  }

  if (running())
    return;

  var frame, tmp, idx = Number(track_bar.value) + offset;
  track_bar.value = idx;
  tmp = idx + 1;

  frame = VNC_frame_data[idx];
  if (!frame)
    return;

  idx = frame.indexOf('{', 1);
  if (idx > -1) {
    ftime.textContent = format_time(frame.slice(1, idx));
    ftime.style.color = '#f00';
  }
}

function track_start(touch) {
  if (track_bar.disabled || vnc_screen_disabled)
    return;

  if (touch === 2)
    touchable = 1;

  if (touchable && touch === 1)
    return;

  track_move();

  skipframes = Number(track_bar.value) + 1;

  if (track_bar_stats !== trackStats.MOVE) {
    track_bar_stats = trackStats.UP;
    start(1, prev_play_stats);
    return;
  }

  track_bar.disabled = true;
  track_bar_stats = trackStats.UP;

  if (frame_idx > skipframes)
    finish();
  if (typeof(vnc_audio) !== 'undefined')
    vnc_audio.skipTo(skipframes / (frame_idx_max + 1));
  start();
}

function track_click(button) {
  var tmp;

  if (track_bar.disabled)
    return;

  skipframes = 0;
  if (full_frame_found)
    begin_frame = full_frame_idx;

  track_stop();

  tmp = Number(track_bar.value);

  switch(button) {
  case 'begin':
    if (tmp > begin_frame)
      track_bar.value = begin_frame;
    else {
      resume();
      return;
    }
    break;
  case 'end':
    if (tmp < frame_idx_max)
      track_bar.value = frame_idx_max;
    else {
      resume();
      return;
    }
    break;
  case 'minus':
    if (tmp <= begin_frame) {
      resume();
      return;
    }

    if (tmp > 2500)
      tmp = parseInt(tmp / 2);
    else if (tmp > 1500)
      tmp = parseInt(tmp * 2 / 3);
    else if (tmp > 1000)
      tmp -= 500;
    else if (tmp > 500)
      tmp -= 200;
    else if (tmp > 100)
      tmp -= 100;
    else if (tmp > 50)
      tmp -= 50;
    else if (tmp > 20)
      tmp -= 20;
    else
      tmp -= 10;

    while (prev_track_value <= tmp)
      tmp -= 10;

    if (tmp > begin_frame)
      track_bar.value = tmp;
    else
      track_bar.value = begin_frame;
    break;
  case 'plus':
    if (tmp === frame_idx_max) {
      resume();
      return;
    }

    tmp += 10;
    if (tmp < frame_idx_max)
      track_bar.value = tmp;
    else
      track_bar.value = frame_idx_max;
    break;
  }
  track_start();
}

document.onkeydown = function(e) {
  if (track_bar.disabled || (mode === 'fullspeed'))
    return;

  //console.info("e.keyCode is " + e.keyCode);
  if (!start_disabled && e.keyCode === 13)
    start();

  if (!e.ctrlKey && !e.shiftKey && !e.altKey)
    return;

  e = window.event || e;

  key = e.which || e.keyCode;

  switch (key) {
  case 37: // Left: -
    track_click('minus');
    break;
  case 39: // Right: +
    track_click('plus');
    break;
  case 38: // Up: begin
    track_click('begin');
    break;
  case 40: // Down: end
    track_click('end');
    break;
  default:
    break;
  }
}

function finish() {
  // Finished with all iterations
  var total_time, end_time = (new Date()).getTime();
  total_time = end_time - start_time;

  iter_time = parseInt(total_time / iterations, 10);
  // Shut-off event interception
  if (typeof(rfb) !== 'undefined' && rfb) {
    rfb.get_mouse().ungrab();
    rfb.get_keyboard().ungrab();
  }

  if (typeof(vnc_audio) !== 'undefined') {
    vnc_audio.skipTo(1);
    vnc_audio.pause();
  }
  play_stats = playStats.FINISH;
  frame_idx = 0;
}

function __finish() {
  if ((mode === 'fullspeed') && (skipframes > 0))
    mode = 'realtime';

  finish();
  resume();
  draw_frame();
}

function update_screensize() {
  var target_width = fullscreen_input && window.innerWidth < screen.width ? window.innerWidth : window.innerWidth - 30;
  var target_height = fullscreen_input ? window.innerWidth : window.innerHeight - play_bar.offsetHeight - 2;

  if (screen_width_input <= 0)
    screen_width = target_width;
  else if (screen_width_input > target_width)
    screen_width = target_width;
  else if (fullscreen)
    screen_width = target_width;
  else
    screen_width = screen_width_input;

  if (screen_height_input <= 0)
    screen_height = target_height;
  else if (screen_height_input > target_height)
    screen_height = target_height;
  else if (fullscreen)
    screen_height = target_height;
  else
    screen_height = screen_height_input;

  if (screen_width > 0 && screen_height === 0)
    screen_height = Math.round(screen_width / screen_ratio);
  if (screen_height > 0 && screen_width === 0)
    screen_width = Math.round(screen_height * screen_ratio);

  if (typeof(rfb) === 'undefined' || !rfb._display)
    return;

  rfb._display.autoscale(screen_width, screen_height, 1);

  var w = vnc_canvas.style.width;
  var h = vnc_canvas.style.height;

  // wait for rfb initialization
  if (vnc_canvas.height <= default_canvas_height)
    return;

  // Fix up for chromium browser
  var vnc_main_offsettop = parseInt(vnc_main.offsetTop);
  if (vnc_main_offsettop > 0 && vnc_main_offsettop < 20 && vnc_screen.offsetHeight + play_bar.offsetHeight >= window.innerHeight) {
    document.body.style.marginTop = (-vnc_main_offsettop + 5) + 'px';
  }

  if (vnc_screen.style.width === w && !fullscreen_input)
    return;

  if (vnc_canvas_backup.width !== vnc_canvas.width) {
    vnc_canvas_backup.width = vnc_canvas.width;
    vnc_canvas_backup.height = vnc_canvas.height;
  }

  vnc_canvas_backup.style.width = w;
  vnc_canvas_backup.style.height = h;

  vnc_records.style.width = w;
  if (parseInt(h) > 100)
    vnc_records.style.height = h;
  else
    vnc_records.style.height = (window.innerHeight - play_bar.offsetHeight - 2) + 'px';

  play_bar.style.width = w;

  var middle_play_bar_width = parseInt(w) - left_play_bar.offsetWidth - right_play_bar.offsetWidth - 4;
  middle_play_bar.style.width = middle_play_bar_width + "px";

  vnc_screen.style.width = w;
}

function update_frameinfo() {
  frame_info['title'] = short_fname;

  for (var k in frame_info) {
    if (typeof("VNC_frame_" + k) !== "'undefined'")
      frame_info[k] = eval("VNC_frame_" + k);
  }

  // the original create time is a timestamp from 1970.1.1
  frame_info['create'] = (new Date(parseFloat(frame_info['create'])*1000)).toLocaleString()
}

function handle_framedata(uri) {
  // console.info("uri: " + uri + " short_fname: " + short_fname);
  if (uri.indexOf(short_fname) < 0) {
    console.info("The async loading data not belong to our session.");
    return;
  }

  index = parseInt(uri.substring(uri.lastIndexOf(".")+1));

  vnc_status.textContent = "data (part " + index + ") Loaded ...";

  if (typeof(VNC_frame_data_compressed) !== 'undefined'
    && typeof(VNC_frame_data_size) !== 'undefined'
    && typeof(VNC_frame_slice_str) !== 'undefined') {
    VNC_frame_data_slice = decompress(VNC_frame_data_compressed, VNC_frame_data_size, VNC_frame_slice_str);
    //console.info("length: " + VNC_frame_data_slice.length);
  }

  if (typeof(VNC_frame_data_slice) === 'undefined' || VNC_frame_data_slice.length === 0) {
    console.info("exit for empty data, network issue or data broken.");
    __finish();
    return;
  }

  if (index !== 0) {
    if (frame_idx >= curr_frame_length)
      stopped_by_me = 1;
  }

  VNC_frame_data = VNC_frame_data.concat(VNC_frame_data_slice);
  curr_frame_length = VNC_frame_data.length - 1;
  VNC_frame_data_slice = 'undefined';
  VNC_frame_data_size = 'undefined';
  VNC_frame_data_compressed = 'undefined';

  //console.info("data.length " + VNC_frame_data.length);
  //console.info("curr_frame_length: " + curr_frame_length + " skipframes: " + skipframes);
  //console.info("stopped_by_me " + stopped_by_me);
  //console.info("frame_idx: " + frame_idx);

  if (index === 0) {
    start(0, 0, 'fullspeed');
  } else if (stopped_by_me && !running()) {
      stopped_by_me = 0;
      resume_control();
      restore();
  }

  next_data_slice = index + 1;
  if (next_data_slice < frame_data_slices)
    check_load_framedata();
}

function check_load_framedata() {
  if (typeof(frame_idx) === 'undefined')
    return;

  if (curr_frame_length >= frame_length - 1)
    return;

  if (curr_frame_length <= skipframes || curr_frame_length <= frame_idx) {
    load_framedata(next_data_slice);
    return;
  }

  //console.info("frame_idx: " + frame_idx + " curr_frame_length: " + curr_frame_length);
  if (frame_idx < curr_frame_length) {
    var f, i, frame_timestamp, loaded_timestamp;
  
    f = VNC_frame_data[frame_idx];
    i = f.indexOf('{', 1);
    i = i < 0 ? f.indexOf('}', 1) : i;
    frame_timestamp = f.slice(1, i);
  
    f = VNC_frame_data[curr_frame_length];
    i = f.indexOf('{', 1);
    i = i < 0 ? f.indexOf('}', 1) : i;
    loaded_timestamp = f.slice(1, i);
  
    //console.info("frame_timestamp: " + frame_timestamp +
    //  " loaded_timestamp: " + loaded_timestamp +
    //  " diff: " + (loaded_timestamp - frame_timestamp));
    i = loaded_timestamp - frame_timestamp - avail_timestamp;
    if (i > 0) {
      if (!running()) {
        console.info("Exit loading checking");
        return;
     }
  
     setTimeout(check_load_framedata, 1000);
     return;
    }
  }

  load_framedata(next_data_slice);
}

function get_audio_uri(fname) {
  var uri;

  raw_fname = fname.replace(".nvz", "").replace(".nvs", "");

  //console.info("short_fname: " + short_fname + " fname: " + fname);
  if (short_fname === fname) {
    if (record_dir.match(/^(http|https|ftp|file):\/\//))
      uri = '' + record_dir + '/' + raw_fname + ".mp3";
    else
      uri = '' + INCLUDE_URI + record_dir + '/' + raw_fname + ".mp3";
  } else {
    uri = raw_fname + ".mp3";
  }

  return uri;
}

function get_uri(fname, part) {
  var uri;

  //console.info("short_fname: " + short_fname + " fname: " + fname);
  if (short_fname === fname) {
    if (record_dir.match(/^(http|https|ftp|file):\/\//))
      uri = '' + record_dir + '/' + fname + "." + part;
    else
      uri = '' + INCLUDE_URI + record_dir + '/' + fname + "." + part;
  } else {
    uri = fname + "." + part;
  }

  return uri;
}

function load_framedata(part) {
  if (typeof(part) === 'undefined')
    part = next_data_slice;

  vnc_status.textContent = "Loading data (part " + (part+1) + ") ...";

  uri = get_uri(fname, part);
  if (uri === prev_uri) {
    console.info("Ignore duplicated loading...");
    return;
  }

  //console.info("data uri is " + uri);
  window.asyncLoad(uri, handle_framedata, 120000);
  prev_uri = uri;
}

function show_records_list() {
  //console.info("show_records_list");
  list_records(); 

  var tmp = fullscreen_input && window.innerWidth < screen.width ? window.innerWidth : window.innerWidth - 30;
  vnc_records.style.width = tmp + "px";
  vnc_records.style.height = window.innerHeight + "px";
  vnc_screen.style.display = "none";
  vnc_records.style.display = "block";
}

function show_default_video() {
  document.body.style.overflow = 'auto';
  vnc_records.style.height = 'auto';
  play_bar.style.display = "none";
  vnc_screen.style.display = "none";
  fullscreen_disabled = 1;

  vnc_default_video.style.display = 'block';
}

window.onscriptsload = function () {
  vnc_status.textContent = "Player Loaded ...";

  if (!has_record_list())
    more_btn.style.display = "none";

  if (fname) {
    init_framedata();
  } else if (has_record_list()) {
    vnc_default_video.innerHTML = '';
    show_records_list();
  } else {
    show_default_video();
  }
}

function load_audio() {
  if (fname) {
    audio_uri = get_audio_uri(fname);
    console.info("Loading audio....");
    vnc_audio.load(audio_uri);
  }
}

function load_record(fname) {
  console.info("Loading video....");
  vnc_status.textContent = "Loading Player ...";

  if (first_load === 1) {
    // Load supporting scripts
    eval("WebUtil.load_scripts({'core': ['base64.js', 'websock.js', 'des.js', 'input/keysym.js', 'input/keysymdef.js', 'input/xtscancodes.js', 'input/util.js', 'input/devices.js', 'display.js', 'rfb.js', 'inflator.js'], 'playback': ['core.js', 'load.js', 'records.js'], 'iframeresizer': ['iframeResizer.contentWindow.min.js'],'" + record_dir + "': [fname, 'records.js'], });");
  
    first_load = 0;
  } else {
    //console.info("Reset and load a new data " + fname);
    reset_framedata();
    eval("WebUtil.load_scripts({'" + record_dir + "': [fname]});");
  }

  play_stats = playStats.LOADING;
}

// called in record list page while the record is choosed
function load(index, suffix) {
  var record = VNC_record_data;
  var record_dir = VNC_record_dir;
  // before append suffix, must remove the old prefix at first
  if (typeof(suffix) === 'undefined')
    fname = record[index][0];
  else
    fname = record[index][0] + suffix;

  fname = fname.replace(/\/$/,"");
  short_fname = fname.replace(/^(ftp|http|https|file):.*\//,"");
  setTimeout(load_audio, 1);

  __finish();
  //console.info("Loading ...... " + fname);
  load_record(fname);
}

function arr2str(uint8array) {
  var array = uint8array;

  if (typeof(array.slice) === 'undefined')
    array.slice = Array.prototype.slice;

  var res = '';
  var chunk = 8 * 1024;
  var i;
  for (i = 0; i < array.length / chunk; i++)
    res += String.fromCharCode.apply(null, array.slice(i * chunk, (i + 1) * chunk));

  res += String.fromCharCode.apply(null, array.slice(i * chunk));
  return res;
}

function decompress(data, size, slice_str) {
  vnc_status.textContent = "Decompressing ...";

  var zlib = new Inflator.Inflate();

  //console.info("base64 encoded data size: " + data.length);
  var tmp = Base64.decode(data);
  //console.info("compressed data size: " + tmp.length);
  var tmp = zlib.inflate(tmp, true, size);
  //console.info("decompressed data size: " + tmp.length);
  zlib.reset();

  return arr2str(tmp).split(slice_str);
}

function reset_framedata() {
  VNC_frame_data = undefined;
  VNC_frame_data = [];
  VNC_frame_data_size = undefined;
  VNC_frame_data_compressed = undefined;
  VNC_frame_title = undefined;
  VNC_frame_author = undefined;
  VNC_frame_create = undefined;
  VNC_frame_time = undefined;
  VNC_frame_length = undefined;
  VNC_frame_slice_str = undefined
  VNC_frame_data_slice = undefined;
  VNC_frame_slices = undefined;

  start_disabled = false;
  vnc_screen_disabled = false;

  play_stats = playStats.INIT;
  prev_play_stats = play_stats;
  track_bar_stats = trackStats.INIT;
  track_bar.value = 0;
  prev_track_value = 0;
  last_x = 0;
  last_y = 0;

  frame_idx = 0;
  frame_length = 0;
  frame_idx_max = 0;
  frame_data_slices = 0;
  skipframes = 0;
  begin_frame = 0;

  prev_canvas_height = default_canvas_height;
  full_frame_found = 0;
  full_frame_idx = 0;
  full_frame_foffset = 0;
  curr_frame_length = 0;

  prev_uri = "";
  next_data_slice = 0;
  stopped_by_me = 0;
  first_load = 0;

  fs_cnt = 0;
  prev_screen_width = 0;
  prev_screen_height = 0;

  frame_info = {'title':'unknown', 'author': 'unknown', 'create': 'unknown', 'time': '00:00:00', 'tags': 'unknown', 'desc': 'unknown'};
}

function init_framedata() {
  var frame_time;

  if (typeof(VNC_frame_data_compressed) !== 'undefined'
    && typeof(VNC_frame_data_size) !== 'undefined'
    && typeof(VNC_frame_slice_str) !== 'undefined')
      VNC_frame_data = decompress(VNC_frame_data_compressed, VNC_frame_data_size, VNC_frame_slice_str);

  if (typeof(VNC_frame_slices) !== 'undefined')
    frame_data_slices = VNC_frame_slices;

  if (typeof(VNC_frame_length) !== 'undefined')
    frame_length = VNC_frame_length;
  else
    frame_length = VNC_frame_data.length;

  curr_frame_length = frame_length;

  if (typeof(VNC_frame_time) !== 'undefined') {
    frame_time = VNC_frame_time;
  } else {
    var frame, i, idx, t;
  
    i = VNC_frame_data.length;
    do {
      i -= 1;
      frame = VNC_frame_data[i];
      idx = frame.indexOf('{', 1);
    } while (idx < 0);
  
    t = frame.slice(1, idx);
    frame_time = format_time(t);
  }

  ftime.textContent = '00:00:00';
  ttime.textContent = frame_time;
  VNC_frame_time = frame_time;

  update_frameinfo();

  frame_idx_max = frame_length - 2;
  track_bar.max = frame_idx_max;
  prev_track_value = frame_idx_max;

  if (frame_data_slices)
    load_framedata(0);
  else
    start(0, 0, 'fullspeed');
}

// Get query variables and do initialization
iterations = 1;
skipframes = 0;
mode = 'realtime';
frames_delta = parseInt(WebUtil.getQueryVar('delta', frames_delta));

screen_width_input = parseInt(WebUtil.getQueryVar('width', 0));
screen_height_input = parseInt(WebUtil.getQueryVar('height', 0));
screen_ratio = parseFloat(WebUtil.getQueryVar('ratio', 16/9));

update_screensize();

fullscreen_input = 0;
if (typeof(FULL_SCREEN) !== 'undefined' && FULL_SCREEN !== '')
  fullscreen_input = FULL_SCREEN;

fullscreen_input = WebUtil.getQueryVar('f', fullscreen_input);
if (fullscreen_input === 0)
  fullscreen_input = WebUtil.getQueryVar('fullscreen', 0);

fullscreen_input = parseInt(fullscreen_input)

if (typeof(RECORD_DIR) !== 'undefined' && RECORD_DIR !== '')
  record_dir = RECORD_DIR;

fname = null;
if (typeof(DATA_URI) !== 'undefined' && DATA_URI !== '')
  fname = DATA_URI;
fname = WebUtil.getQueryVar('data', fname);
if (fname)
  short_fname = fname.replace(/^(ftp|http|https|file):.*\//,"");

// Init audiojs
audios = audiojs.createAll();
vnc_audio = audios[0];

if (typeof(vnc_audio) !== 'undefined') {
  vnc_audio.wrapper.style.display = 'none';
  setTimeout(load_audio, 1);
}

if (fname) {
  vnc_default_video.innerHTML = '';
  load_record(fname);
} else {
  load_records();
  vnc_status.textContent = 'Usage: https://vplayer.io?data=FOO';
}

more_btn.addEventListener('click', op_records, false);
fs_btn.addEventListener('click', full_screen, false);

track_bar.addEventListener('touchstart', track_stop, false);
vnc_screen.addEventListener('touchstart', function(event) { track_stop(2, event); }, false);
track_bar.addEventListener('mousedown', track_stop, false);
vnc_screen.addEventListener('mousedown', function(event) { track_stop(1, event); }, false);
track_bar.addEventListener('touchmove', track_move, false);
vnc_screen.addEventListener('touchmove', function(event) { track_move(2, event); }, false);
track_bar.addEventListener('mousemove', track_move, false);
vnc_screen.addEventListener('mousemove', function(event) { track_move(1, event); }, false);
track_bar.addEventListener('touchend', track_start, false);
vnc_screen.addEventListener('touchend', function(event) { track_start(2, event); }, false);
track_bar.addEventListener('mouseup', track_start, false);
vnc_screen.addEventListener('mouseup', function(event) { track_start(1, event); }, false);
vnc_screen.addEventListener('mouseout', function(event) { track_bar_stats = trackStats.INIT; }, false);

window.onresize = function() {
  check_fullscreen();

  update_screensize();
}

window.onblur = function() {
  if (!full_frame_found)
    return;

  if (frame_idx >= frame_idx_max)
    return;

  if (!(skipframes > frame_idx))
    stop();
}
