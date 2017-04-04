
# vplayer.io: noVNC player

## Introduction

[noVNC][1] is a HTML5 VNC Client, it can record the VNC sessions in noVNC format.

Based on the [tests/vnc_playback.html][2], vplayer adds more features and let it work as a real video player.

In additional, [pyvnc2swf][3] and [Cloud Ubuntu][4] are enhanced to easier the noVNC session recording. 

[pyvnc2swf][3] is a cross-platform screen recording tool for ShockWave Flash (swf), Flash Video (flv), MPEG and raw VNCRev format, we add noVNC format output support.

[Cloud Ubuntu][4] develops docker images with Ubuntu+ssh+noVNC+gateone support, the `tinylab/cloud-ubuntu-web` image imports noVNC and improves it to a real Web VNC Client with easier the VNC server configuration (Token as `vnc://server_ip:server_port`) and the VNC session recording (specify `record=1` for vnc.html).

## Usage

Use `pyvnc2swf` or `tinylab/cloud-ubuntu-web` to record the VNC sessions to `recordings/` and then, play it with such url in any modern web browser.

Use `vplayer.io demonstration` as an example. The recorded session is saved as `recordings/vplayer.io.nvz` and/or sliced to `recordings/vplayer.io.nvs*` for better access speed.

1. Play the video
    * Slow: <http://vplayer.io?data=vplayer.io.nvz>
    * Fast: <http://vplayer.io?data=vplayer.io.nvs>

2. Embed the video in a web page

    There is an example: <http://vplayer.io/examples/embed.html>:

        <iframe src="http://vplayer.io?data=vplayer.io.nvs&f=1" width="100%" marginheight="0" marginwidth="0" frameborder="0" scrolling="no" border="0" allowfullscreen></iframe>

3. Auto resize the video size

     [iframeResizer][5] can auto resize the video size:

        <script src="./jquery/jquery-1.10.1.min.js"></script>
        <script src="./iframeresizer/iframeResizer.min.js"></script>
        <script>
          function resize_iframe() {
            iFrameResize({
                log: false,
                autoResize: true,
                interval: -1,
                minHeight: 300,
                heightCalculationMethod: "lowestElement",
            });
          }
          $(document).ready(function () {
            resize_iframe();
          });
        </script>

[1]: https://github.com/novnc/noVNC
[2]: https://github.com/novnc/noVNC/blob/master/tests/vnc_playback.html
[3]: https://github.com/tinyclub/pyvnc2swf
[4]: https://github.com/tinyclub/cloud-ubuntu
[5]: https://github.com/davidjbradshaw/iframe-resizer
