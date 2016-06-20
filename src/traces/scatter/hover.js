/**
* Copyright 2012-2016, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var Lib = require('../../lib');
var Fx = require('../../plots/cartesian/graph_interact');
var constants = require('../../plots/cartesian/constants');
var ErrorBars = require('../../components/errorbars');
var getTraceColor = require('./get_trace_color');
var Color = require('../../components/color');


module.exports = function hoverPoints(pointData, xval, yval, hovermode) {
    var cd = pointData.cd,
        trace = cd[0].trace,
        xa = pointData.xa,
        ya = pointData.ya,
        xpx = xa.c2p(xval),
        ypx = ya.c2p(yval),
        pt = [xpx, ypx];

    // even if hoveron is 'fills', only use it if we have polygons too
    if(trace.hoveron === 'fills' && trace._polygons) {
        var polygons = trace._polygons,
            polygonsIn = [],
            inside = false,
            xmin = Infinity,
            xmax = -Infinity,
            ymin = Infinity,
            ymax = -Infinity,
            i, j, polygon, pts, xCross, x0, x1, y0, y1;

        for(i = 0; i < polygons.length; i++) {
            polygon = polygons[i];
            // TODO: this is not going to work right for curved edges, it will
            // act as though they're straight. That's probably going to need
            // the elements themselves to capture the events. Worth it?
            if(polygon.contains(pt)) {
                inside = !inside;
                // TODO: need better than just the overall bounding box
                polygonsIn.push(polygon);
                ymin = Math.min(ymin, polygon.ymin);
                ymax = Math.max(ymax, polygon.ymax);
            }
        }

        if(inside) {
            // find the overall left-most and right-most points of the
            // polygon(s) we're inside at their combined vertical midpoint.
            // This is where we will draw the hover label.
            // Note that this might not be the vertical midpoint of the
            // whole trace, if it's disjoint.
            var yAvg = (ymin + ymax) / 2;
            for(i = 0; i < polygonsIn.length; i++) {
                pts = polygonsIn[i].pts;
                for(j = 1; j < pts.length; j++) {
                    y0 = pts[j - 1][1];
                    y1 = pts[j][1];
                    if((y0 > yAvg) !== (y1 >= yAvg)) {
                        x0 = pts[j - 1][0];
                        x1 = pts[j][0];
                        xCross = x0 + (x1 - x0) * (yAvg - y0) / (y1 - y0);
                        xmin = Math.min(xmin, xCross);
                        xmax = Math.max(xmax, xCross);
                    }
                }
            }

            // get only fill or line color for the hover color
            var color = Color.defaultLine;
            if(Color.opacity(trace.fillcolor)) color = trace.fillcolor;
            else if(Color.opacity((trace.line || {}).color)) {
                color = trace.line.color;
            }

            Lib.extendFlat(pointData, {
                // never let a 2D override 1D type as closest point
                distance: constants.MAXDIST + 10,
                x0: xmin,
                x1: xmax,
                y0: yAvg,
                y1: yAvg,
                color: color
            });

            delete pointData.index;

            if(trace.text && !Array.isArray(trace.text)) {
                pointData.text = String(trace.text);
            }
            else pointData.text = trace.name;

            return [pointData];
        }
    }
    else {
        var dx = function(di) {
                // scatter points: d.mrc is the calculated marker radius
                // adjust the distance so if you're inside the marker it
                // always will show up regardless of point size, but
                // prioritize smaller points
                var rad = Math.max(3, di.mrc || 0);
                return Math.max(Math.abs(xa.c2p(di.x) - xa.c2p(xval)) - rad, 1 - 3 / rad);
            },
            dy = function(di) {
                var rad = Math.max(3, di.mrc || 0);
                return Math.max(Math.abs(ya.c2p(di.y) - ya.c2p(yval)) - rad, 1 - 3 / rad);
            },
            dxy = function(di) {
                var rad = Math.max(3, di.mrc || 0),
                    dx = Math.abs(xa.c2p(di.x) - xa.c2p(xval)),
                    dy = Math.abs(ya.c2p(di.y) - ya.c2p(yval));
                return Math.max(Math.sqrt(dx * dx + dy * dy) - rad, 1 - 3 / rad);
            },
            distfn = Fx.getDistanceFunction(hovermode, dx, dy, dxy);

        Fx.getClosest(cd, distfn, pointData);

        // skip the rest (for this trace) if we didn't find a close point
        if(pointData.index === false) return;

        // the closest data point
        var di = cd[pointData.index],
            xc = xa.c2p(di.x, true),
            yc = ya.c2p(di.y, true),
            rad = di.mrc || 1;

        pointData.color = getTraceColor(trace, di);

        pointData.x0 = xc - rad;
        pointData.x1 = xc + rad;
        pointData.xLabelVal = di.x;

        pointData.y0 = yc - rad;
        pointData.y1 = yc + rad;
        pointData.yLabelVal = di.y;

        if(di.tx) pointData.text = di.tx;
        else if(trace.text) pointData.text = trace.text;

        ErrorBars.hoverInfo(di, trace, pointData);

        return [pointData];
    }
};
