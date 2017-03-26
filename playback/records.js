/* vplayer: records.js
 *
 * Copyright: (c) 2017 Wu Zhangjin - wuzhangjin@gmail.com
 * License: GPL 2.0
 * Version: 0.1
 */

function has_record_list() {
  if (typeof(VNC_record_data) === 'undefined'
      || typeof(VNC_record_dir) === 'undefined') {
    return false;
  }

  return true;
}

function list_records(theme) {
  if (!has_record_list())
    return false;

  var target = document.getElementById('VNC_records');
  var data = new Array();
  var record = VNC_record_data;
  var record_dir = VNC_record_dir;
  var player;

  if (typeof(VPLAYER_URI) !== 'undefined' && VPLAYER_URI !== '')
    player = VPLAYER_URI;
  else
    player = VNC_record_player;

  data.push("<table>\n")

  data.push("<tr class='head'>\n");
  data.push("<th> Play </th>\n");
  data.push("<th> No. </th>\n");

  var i, head = record[0];
  for (i = 1; i < head.length - 1; i++)
    data.push("<th>" + head[i] + "</th>\n");
  data.push("</tr>\n");

  var bg, row, j, play_url, down_url;
  for (i = 1; i < record.length; i++) {
    bg = "even";
    if (i % 2 === 0)
      bg = "odd";

    data.push("<tr class='" + bg + "'>\n");

    row = record[i];

    down_url = record_dir + "/" + row[0];
    if (theme) {
      data.push("<td><input type='radio' name='session' onclick='load(" + i + ");'></td>\n");
    } else {
      play_url = player + "?data=" + row[0];
      data.push("<td><a href='" + play_url + "'>&gt;</a></td>\n");
    }

    data.push("<td> " + i + " </td>\n");

    // time from timestamp in millseconds to localtime format
    row[4] = (new Date(parseFloat(row[4])*1000)).toLocaleString();
    for (j = 1; j < row.length - 1; j++)
      data.push("<td>" + row[j] + "</td>\n");

    data.push("</tr>\n");
  }

  data.push("</table>")

  target.innerHTML = data.join('');
  return true;
}


function draw_records() {
  return list_records(1);
}
