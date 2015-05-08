/**
*
* Image Canvas Class
* @package FILTER.js
*
* NOTE: it won't work locally (at least with Firefox), only with server
**/
!function(FILTER, undef){
@@USE_STRICT@@

var devicePixelRatio = FILTER.devicePixelRatio,
    IMG = FILTER.ImArray, IMGcpy = FILTER.ImArrayCopy, A32F = FILTER.Array32F,
    createCanvas = FILTER.createCanvas,
    notSupportTyped = FILTER._notSupportTypedArrays,
    Min = Math.min, Floor = Math.floor,
    FORMAT = FILTER.FORMAT,
    MIME = FILTER.MIME
;

var IDATA = 1, ODATA = 2, ISEL = 4, OSEL = 8, HIST = 16, SAT = 32, SPECTRUM = 64,
    WIDTH = 2, HEIGHT = 4, WIDTH_AND_HEIGHT = WIDTH | HEIGHT,
    SEL = ISEL|OSEL, DATA = IDATA|ODATA,
    CLEAR_DATA = ~DATA, CLEAR_SEL = ~SEL,
    CLEAR_HIST = ~HIST, CLEAR_SAT = ~SAT, CLEAR_SPECTRUM = ~SPECTRUM
;

// auxilliary (private) methods
function _getTmpCanvas( scope ) 
{
    var w = scope.width, h = scope.height,
        cnv = createCanvas(w, h);
    cnv.width = w * devicePixelRatio;
    cnv.height = h * devicePixelRatio;
    return cnv;
}

function _setDimensions( scope, w, h, what ) 
{
    what = what || WIDTH_AND_HEIGHT;
    if ( what & WIDTH )
    {
        scope.width = w;
        scope.oCanvas.style.width = w + 'px';
        scope.oCanvas.width = w * devicePixelRatio;
        if ( scope._restorable ) 
        {
        scope.iCanvas.style.width = scope.oCanvas.style.width;
        scope.iCanvas.width = scope.oCanvas.width;
        }
        if ( scope.tmpCanvas )
        {
            scope.tmpCanvas.style.width = scope.oCanvas.style.width;
            scope.tmpCanvas.width = scope.oCanvas.width;
        }
    }
    if ( what & HEIGHT )
    {
        scope.height = h;
        scope.oCanvas.style.height = h + 'px';
        scope.oCanvas.height = h * devicePixelRatio;
        if ( scope._restorable ) 
        {
        scope.iCanvas.style.height = scope.oCanvas.style.height;
        scope.iCanvas.height = scope.oCanvas.height;
        }
        if ( scope.tmpCanvas )
        {
            scope.tmpCanvas.style.height = scope.oCanvas.style.height;
            scope.tmpCanvas.height = scope.oCanvas.height;
        }
    }
    return scope;
}

// compute integral image (sum of columns)
function _computeIntegral( scope ) 
{
    var w = scope.width, h = scope.height, rowLen = w<<2,
        integralR, integralG, integralB, colR, colG, colB,
        im = scope.getPixelData().data, imLen = im.length, count = (imLen>>2), i, j, x
    ;
    // compute integral of image in one pass
    integralR = new A32F(count); integralG = new A32F(count); integralB = new A32F(count);
    // first row
    j=0; i=0; colR=colG=colB=0;
    for (x=0; x<w; x++, i+=4, j++)
    {
        colR+=im[i]; colG+=im[i+1]; colB+=im[i+2];
        integralR[j]=colR; integralG[j]=colG; integralB[j]=colB;
    }
    // other rows
    i=rowLen; x=0; j=0; colR=colG=colB=0;
    for (i=rowLen; i<imLen; i+=4, j++, x++)
    {
        if (x>=w) { x=0; colR=colG=colB=0; }
        colR+=im[i]; colG+=im[i+1]; colB+=im[i+2];
        integralR[j+w]=integralR[j]+colR; integralG[j+w]=integralG[j]+colG; integralB[j+w]=integralB[j]+colB;
    }
    scope._integral = [integralR, integralG, integralB];
    scope._needsRefresh &= CLEAR_SAT;
    return scope;
}

function _computeHistogram( scope ) 
{
    var im = scope.getPixelData().data, l = im.length,
        maxR=0, maxG=0, maxB=0, minR=255, minG=255, minB=255,
        cdfR, cdfG, cdfB, r,g,b,
        accumR, accumG, accumB,
        i, n=1.0/(l>>2)
    ;
    
    // initialize the arrays
    cdfR=new A32F(256); cdfG=new A32F(256); cdfB=new A32F(256);
    for (i=0; i<256; i+=4) 
    { 
        // partial loop unrolling
        cdfR[i]=0; cdfG[i]=0; cdfB[i]=0;
        cdfR[i+1]=0; cdfG[i+1]=0; cdfB[i+1]=0;
        cdfR[i+2]=0; cdfG[i+2]=0; cdfB[i+2]=0;
        cdfR[i+3]=0; cdfG[i+3]=0; cdfB[i+3]=0;
    }
    
    // compute pdf and maxima/minima
    for (i=0; i<l; i+=4)
    {
        r = im[i]; g = im[i+1]; b = im[i+2];
        cdfR[r] += n; cdfG[g] += n; cdfB[b] += n;
        
        if (r>maxR) maxR=r;
        else if (r<minR) minR=r;
        if (g>maxG) maxG=g;
        else if (g<minG) minG=g;
        if (b>maxB) maxB=b;
        else if (b<minB) minB=b;
    }
    
    // compute cdf
    accumR=accumG=accumB=0;
    for (i=0; i<256; i+=4) 
    { 
        // partial loop unrolling
        accumR += cdfR[i]; cdfR[i] = accumR;
        accumG += cdfG[i]; cdfG[i] = accumG;
        accumB += cdfB[i]; cdfB[i] = accumB;
        accumR += cdfR[i+1]; cdfR[i+1] = accumR;
        accumG += cdfG[i+1]; cdfG[i+1] = accumG;
        accumB += cdfB[i+1]; cdfB[i+1] = accumB;
        accumR += cdfR[i+2]; cdfR[i+2] = accumR;
        accumG += cdfG[i+2]; cdfG[i+2] = accumG;
        accumB += cdfB[i+2]; cdfB[i+2] = accumB;
        accumR += cdfR[i+3]; cdfR[i+3] = accumR;
        accumG += cdfG[i+3]; cdfG[i+3] = accumG;
        accumB += cdfB[i+3]; cdfB[i+3] = accumB;
    }
    
    scope._histogram = [cdfR, cdfG, cdfB];
    scope._needsRefresh &= CLEAR_HIST;
    return scope;
}
/*
function _computeSpectrum( scope )
{
    scope._needsRefresh &= CLEAR_SPECTRUM;
    return scope;
}
*/
function _refreshData( scope, what ) 
{
    var w = scope.width, h = scope.height;
    what = what || 255;
    if ( scope._restorable && (what & IDATA) && (scope._needsRefresh & IDATA) )
    {
        scope.iData = scope.ictx.getImageData(0, 0, w, h);
        scope._needsRefresh &= ~IDATA;
    }
    if ( (what & ODATA) && (scope._needsRefresh & ODATA) )
    {
        scope.oData = scope.octx.getImageData(0, 0, w, h);
        scope._needsRefresh &= ~ODATA;
    }
    //scope._needsRefresh &= CLEAR_DATA;
    return scope;
}

function _refreshSelectedData( scope, what ) 
{
    if ( scope.selection )
    {
        var sel = scope.selection, ow = scope.width-1, oh = scope.height-1,
            xs = Floor(sel[0]*ow), ys = Floor(sel[1]*oh), 
            ws = Floor(sel[2]*ow)-xs+1, hs = Floor(sel[3]*oh)-ys+1
        ;
        what = what || 255;
        if ( scope._restorable && (what & ISEL) && (scope._needsRefresh & ISEL) )
        {
            scope.iDataSel = scope.ictx.getImageData(xs, ys, ws, hs);
            scope._needsRefresh &= ~ISEL;
        }
        if ( (what & OSEL) && (scope._needsRefresh & OSEL) )
        {
            scope.oDataSel = scope.octx.getImageData(xs, ys, ws, hs);
            scope._needsRefresh &= ~OSEL;
        }
    }
    //scope._needsRefresh &= CLEAR_SEL;
    return scope;
}
    
//
//
// Image (Proxy) Class
var FilterImage = FILTER.Image = FILTER.Class({
    name: "Image"
    
    ,constructor: function( img ) {
        var self = this, w = 0, h = 0;
        // factory-constructor pattern
        if ( !(self instanceof FilterImage) ) return new FilterImage(img);
        self.width = w; self.height = h;
        self.iData = null; self.iDataSel = null;
        self.oData = null; self.oDataSel = null;
        self.iCanvas = createCanvas(w, h);
        self.oCanvas = createCanvas(w, h);
        self.tmpCanvas = null;
        self.domElement = self.oCanvas;
        self.ictx = self.iCanvas.getContext('2d');
        self.octx = self.oCanvas.getContext('2d');
        self.webgl = null;
        self._histogram = null;
        self._integral = null;
        self._spectrum = null;
        // lazy
        self.selection = null;
        self._needsRefresh = 0;
        self._restorable = true;
        if ( img ) self.setImage( img );
    }
    
    // properties
    ,width: 0
    ,height: 0
    ,selection: null
    ,iCanvas: null
    ,oCanvas: null
    ,tmpCanvas: null
    ,ictx: null
    ,octx: null
    ,iData: null
    ,iDataSel: null
    ,oData: null
    ,oDataSel: null
    ,domElement: null
    ,webgl: null
    ,_histogram: null
    ,_integral: null
    ,_spectrum: null
    ,_needsRefresh: 0
    ,_restorable: true
    
    ,dispose: function( ) {
        var self = this;
        self.width = null;
        self.height = null;
        self.selection = null;
        self.ictx = null;
        self.octx = null;
        self.iData = null;
        self.iDataSel = null;
        self.oData = null;
        self.oDataSel = null;
        self.iCanvas = null;
        self.oCanvas = null;
        self.tmpCanvas = null;
        self.domElement = null;
        self.webgl = null;
        self._histogram = null;
        self._integral = null;
        self._spectrum = null;
        self._needsRefresh = null;
        self._restorable = null;
        return self;
    }
    
    ,restorable: function( enabled ) {
        var self = this;
        if ( !arguments.length ) enabled = true;
        self._restorable = !!enabled;
        return self;
    }
    
    // apply a filter (uses filter's own apply method)
    ,apply: function( filter, cb ) {
        filter.apply( this, this, cb || null );
        return this;
    }
    
    // apply2 a filter using another image as destination
    ,apply2: function( filter, destImg, cb ) {
        filter.apply( this, destImg, cb || null );
        return this;
    }
    
    ,select: function( x1, y1, x2, y2 ) {
        var self = this, argslen = arguments.length;
        // default
        if ( argslen < 1 ) x1 = 0;
        if ( argslen < 2 ) y1 = 0;
        if ( argslen < 3 ) x2 = 1;
        if ( argslen < 4 ) y2 = 1;
        // select
        self.selection = [ 
            // clamp
            0 > x1 ? 0 : (1 < x1 ? 1 : x1),
            0 > y1 ? 0 : (1 < y1 ? 1 : y1),
            0 > x2 ? 0 : (1 < x2 ? 1 : x2),
            0 > y2 ? 0 : (1 < y2 ? 1 : y2)
        ];
        self._needsRefresh |= SEL;
        return self;
    }
    
    ,deselect: function( ) {
        var self = this;
        self.selection = null;
        self.iDataSel = null;
        self.oDataSel = null;
        self._needsRefresh &= CLEAR_SEL;
        return self;
    }
    
    // store the processed/filtered image as the original image
    // make the processed image the original image
    ,store: function( ) {
        var self = this;
        if ( self._restorable )
        {
            self.ictx.drawImage(self.oCanvas, 0, 0); 
            self._needsRefresh |= IDATA;
            if (self.selection) self._needsRefresh |= ISEL;
        }
        return self;
    }
    
    // restore the original image
    // remove any filters applied to original image
    ,restore: function( ) {
        var self = this;
        if ( self._restorable )
        {
            self.octx.drawImage(self.iCanvas, 0, 0); 
            self._needsRefresh |= ODATA | HIST | SAT | SPECTRUM;
            if (self.selection) self._needsRefresh |= OSEL;
        }
        return self;
    }
    
    // clear the image contents
    ,clear: function( ) {
        var self = this, w = self.width, h = self.height;
        if ( w && h )
        {
            if ( self._restorable ) self.ictx.clearRect(0, 0, w, h);
            self.octx.clearRect(0, 0, w, h);
            self._needsRefresh |= DATA | HIST | SAT | SPECTRUM;
            if (self.selection) self._needsRefresh |= SEL;
        }
        return self;
    }
    
    // fill image region contents with a specific background color
    ,fill: function( color, x, y, w, h ) {
        var self = this, W = self.width, H = self.height;
        
        if (!w && W && !h && H) return self;
        
        // create the image data if needed
        if (w && !W && h && !H) self.createImageData(w, h);
        
        var ictx = self.ictx, octx = self.octx;
        color = color||0; 
        x = x||0; y = y||0; 
        w = w||W; h = h||H;
        
        if ( self._restorable )
        {
        ictx.fillStyle = color;  
        ictx.fillRect(x, y, w, h);
        }
        
        octx.fillStyle = color;  
        octx.fillRect(x, y, w, h);
        
        self._needsRefresh |= DATA | HIST | SAT | SPECTRUM;
        if (self.selection) self._needsRefresh |= SEL;
        return self;
    }
    
    ,setDimensions: function( w, h ) {
        var self = this;
        _setDimensions(self, w, h, WIDTH_AND_HEIGHT);
        self._needsRefresh |= DATA | HIST | SAT | SPECTRUM;
        if (self.selection) self._needsRefresh |= SEL;
        return self;
    }
    
    // get direct data array
    ,getData: function( ) {
        var self = this, Data;
        if ( self._restorable )
        {
        if (self._needsRefresh & IDATA) _refreshData( self, IDATA );
        Data = self.iData;
        }
        else
        {
        if (self._needsRefresh & ODATA) _refreshData( self, ODATA );
        Data = self.oData;
        }
        // clone it
        return new IMGcpy( Data.data );
    }
    
    // get direct data array of selected part
    ,getSelectedData: function( ) {
        var self = this, sel;
        
        if (self.selection)  
        {
            if ( self._restorable )
            {
            if (self._needsRefresh & ISEL) _refreshSelectedData( self, ISEL );
            sel = self.iDataSel;
            }
            else
            {
            if (self._needsRefresh & OSEL) _refreshSelectedData( self, OSEL );
            sel = self.oDataSel;
            }
        }
        else
        {
            if ( self._restorable )
            {
            if (self._needsRefresh & IDATA) _refreshData( self, IDATA );
            sel = self.iData;
            }
            else
            {
            if (self._needsRefresh & ODATA) _refreshData( self, ODATA );
            sel = self.oData;
            }
        }
        // clone it
        return [new IMGcpy( sel.data ), sel.width, sel.height];
    }
    
    // get processed data array
    ,getProcessedData: function( ) {
        var self = this;
        if (self._needsRefresh & ODATA) _refreshData( self, ODATA );
        // clone it
        return new IMGcpy( self.oData.data );
    }
    
    // get processed data array of selected part
    ,getProcessedSelectedData: function( ) {
        var self = this, sel;
        
        if (self.selection)  
        {
            if (self._needsRefresh & OSEL) _refreshSelectedData( self, OSEL );
            sel = self.oDataSel;
        }
        else
        {
            if (self._needsRefresh & ODATA) _refreshData( self, ODATA );
            sel = self.oData;
        }
        // clone it
        return [new IMGcpy( sel.data ), sel.width, sel.height];
    }
    
    // set direct data array
    ,setData: function(a) {
        var self = this;
        if (self._needsRefresh & ODATA) _refreshData( self, ODATA );
        self.oData.data.set( a ); // not supported in Opera, IE, Safari
        self.octx.putImageData(self.oData, 0, 0); 
        self._needsRefresh |= HIST | SAT | SPECTRUM;
        if (self.selection) self._needsRefresh |= OSEL;
        return self;
    }
    
    // set direct data array of selected part
    ,setSelectedData: function(a) {
        var self = this;
        if (self.selection)
        {
            var sel = self.selection, ow = self.width-1, oh = self.height-1,
                xs = Floor(sel[0]*ow), ys = Floor(sel[1]*oh);
            if (self._needsRefresh & OSEL) _refreshSelectedData( self, OSEL );
            self.oDataSel.data.set(a); // not supported in Opera, IE, Safari
            self.octx.putImageData(self.oDataSel, xs, ys); 
            self._needsRefresh |= ODATA;
        }
        else
        {
            if (self._needsRefresh & ODATA) _refreshData( self, ODATA );
            self.oData.data.set( a ); // not supported in Opera, IE, Safari
            self.octx.putImageData(self.oData, 0, 0); 
        }
        self._needsRefresh |= HIST | SAT | SPECTRUM;
        return self;
    }
    
    ,createImageData: function( w, h ) {
        var self = this, ictx, octx;
        _setDimensions(self, w, h, WIDTH_AND_HEIGHT);
        if ( self._restorable ) 
        {
        ictx = self.ictx = self.iCanvas.getContext('2d');
        ictx.createImageData(w, h);
        }
        octx = self.octx = self.oCanvas.getContext('2d');
        octx.createImageData(w, h);
        self._needsRefresh |= DATA;
        if (self.selection) self._needsRefresh |= SEL;
        return self;
    }
    
    ,setImage: function( img ) {
        if ( !img ) return this;
        
        var self = this, ictx, octx, w, h, 
            isFilterImage, isVideo, isCanvas, isImage//, isImageData
        ;
        
        isFilterImage = img instanceof FilterImage;
        if ( isFilterImage ) img = img.oCanvas;
        isVideo = img instanceof HTMLVideoElement;
        isCanvas = img instanceof HTMLCanvasElement;
        isImage = img instanceof Image;
        //isImageData = img instanceof Object || "object" === typeof img;
        
        if ( isVideo )
        {
            w = img.videoWidth;
            h = img.videoHeight;
        }
        else
        {
            w = img.width;
            h = img.height;
        }
        
        if ( isImage || isCanvas || isVideo ) 
        {
            _setDimensions(self, w, h, WIDTH_AND_HEIGHT);
            if ( self._restorable ) 
            {
            ictx = self.ictx = self.iCanvas.getContext('2d');
            ictx.drawImage(img, 0, 0);
            }
            octx = self.octx = self.oCanvas.getContext('2d');
            octx.drawImage(img, 0, 0);
            self._needsRefresh |= DATA;
        }
        else
        {
            if ( !self.oData ) 
            {
                self.createImageData(w, h);
                _refreshData(self, DATA);
            }
            
            if ( self._restorable )
            {
            ictx = self.ictx = self.iCanvas.getContext('2d');
            self.iData.data.set(img.data); // not supported in Opera, IE, Safari
            ictx.putImageData(self.iData, 0, 0); 
            }
            
            octx = self.octx = self.oCanvas.getContext('2d');
            self.oData.data.set(img.data); // not supported in Opera, IE, Safari
            octx.putImageData(self.oData, 0, 0); 
            //self._needsRefresh &= CLEAR_DATA;
        }
        //self.webgl = FILTER.useWebGL ? new FILTER.WebGL(self.domElement) : null;
        self._needsRefresh |= HIST | SAT | SPECTRUM;
        if (self.selection) self._needsRefresh |= SEL;
        return self;
    }
    
    ,getPixel: function( x, y ) {
        var self = this;
        if (self._needsRefresh & ODATA) _refreshData( self, ODATA );
        var off = ~~(y*self.width+x+0.5), im = self.oData.data;
        return {
            r: im[off], 
            g: im[off+1], 
            b: im[off+2], 
            a: im[off+3]
        };
    }
    
    ,setPixel: function( x, y, r, g, b, a ) {
        var self = this, t = new IMG([r&255, g&255, b&255, a&255]);
        self.octx.putImageData(t, x, y); 
        self._needsRefresh |= ODATA | HIST | SAT | SPECTRUM;
        if (self.selection) self._needsRefresh |= OSEL;
        return self;
    }
    
    // get the imageData object
    ,getPixelData: function( ) {
        if (this._needsRefresh & ODATA) _refreshData( this, ODATA );
        return this.oData;
    }
    
    // set the imageData object
    ,setPixelData: function( data ) {
        var self = this;
        self.octx.putImageData(data, 0, 0); 
        self._needsRefresh |= ODATA | HIST | SAT | SPECTRUM;
        if (self.selection) self._needsRefresh |= OSEL;
        return self;
    }
    
    ,clone: function( original ) {
        return new FilterImage(true === original ? this.iCanvas : this.oCanvas);
    }
    
    ,scale: function( sx, sy ) {
        var self = this;
        sx = sx||1; sy = sy||sx;
        if ( 1==sx && 1==sy ) return self;
        
        // lazy
        self.tmpCanvas = self.tmpCanvas || _getTmpCanvas( self );
        var ctx = self.tmpCanvas.getContext('2d'),
            w = self.width, h = self.height;
        
        //ctx.save();
        ctx.scale(sx, sy);
        w = self.width = ~~(sx*w+0.5);
        h = self.height = ~~(sy*h+0.5);
        
        ctx.drawImage(self.oCanvas, 0, 0);
        self.oCanvas.style.width = w + 'px';
        self.oCanvas.style.height = h + 'px';
        self.oCanvas.width = w * devicePixelRatio;
        self.oCanvas.height = h * devicePixelRatio;
        self.octx.drawImage(self.tmpCanvas, 0, 0);
        
        if ( self._restorable )
        {
        ctx.drawImage(self.iCanvas, 0, 0);
        self.iCanvas.style.width = self.oCanvas.style.width;
        self.iCanvas.style.height = self.oCanvas.style.height;
        self.iCanvas.width = self.oCanvas.width;
        self.iCanvas.height = self.oCanvas.height;
        self.ictx.drawImage(self.tmpCanvas, 0, 0);
        }
        
        self.tmpCanvas.width = self.oCanvas.width;
        self.tmpCanvas.height = self.oCanvas.height;
        //ctx.restore();
        
        self._needsRefresh |= DATA | HIST | SAT | SPECTRUM;
        if (self.selection) self._needsRefresh |= SEL;
        return self;
    }
    
    ,flipHorizontal: function( ) {
        var self = this;
        // lazy
        self.tmpCanvas = self.tmpCanvas || _getTmpCanvas( self );
        var ctx = self.tmpCanvas.getContext('2d');
        
        ctx.translate(self.width, 0); 
        ctx.scale(-1, 1);
        
        ctx.drawImage(self.oCanvas, 0, 0);
        self.octx.drawImage(self.tmpCanvas, 0, 0);
        
        if ( self._restorable )
        {
        ctx.drawImage(self.iCanvas, 0, 0);
        self.ictx.drawImage(self.tmpCanvas, 0, 0);
        }
        
        self._needsRefresh |= DATA | HIST | SAT | SPECTRUM;
        if (self.selection) self._needsRefresh |= SEL;
        return self;
    }
    
    ,flipVertical: function( ) {
        var self = this;
        // lazy
        self.tmpCanvas = self.tmpCanvas || _getTmpCanvas( self );
        var ctx = self.tmpCanvas.getContext('2d');
        
        ctx.translate(0, self.height); 
        ctx.scale(1, -1);
        
        ctx.drawImage(self.oCanvas, 0, 0);
        self.octx.drawImage(self.tmpCanvas, 0, 0);
        
        if ( self._restorable )
        {
        ctx.drawImage(self.iCanvas, 0, 0);
        self.ictx.drawImage(self.tmpCanvas, 0, 0);
        }
        
        self._needsRefresh |= DATA | HIST | SAT | SPECTRUM;
        if (self.selection) self._needsRefresh |= SEL;
        return self;
    }
    
    // TODO
    ,draw: function( drawable, x, y, blendMode ) {
        return this;
    }
    
    ,integral: function( ) {
        if (this._needsRefresh & SAT) _computeIntegral( this );
        return this._integral;
    }
    
    ,histogram: function( ) {
        if (this._needsRefresh & HIST) _computeHistogram( this );
        return this._histogram;
    }
    
    // TODO
    ,spectrum: function( ) {
        //if (this._needsRefresh & SPECTRUM) _computeSpectrum( this );
        return this._spectrum;
    }
    
    ,toImage: function( format ) {
        var canvas = this.oCanvas, uri, quality = 1.0;
        if ( format & FORMAT.JPG )
        {
            uri = canvas.toDataURL( MIME.JPG, quality );
        }
        else if ( format & FORMAT.GIF )
        {
            uri = canvas.toDataURL( MIME.GIF, quality );
        }
        else/* if( format & FORMAT.PNG )*/
        {
            uri = canvas.toDataURL( MIME.PNG, quality );
        }
        if ( format & FORMAT.IMAGE )
        {
            var img = new Image( );
            img.src = uri;
            return img;
        }
        return uri;
    }
    
    ,toString: function( ) {
        return "[" + "FILTER Image: " + this.name + "]";
    }
});
// static
/*FilterImage.scale = FilterImage.resize = function( data, w, h, nw, nh ) {
    var canvas = createCanvas(w, h),
        scaledCanvas = createCanvas(nw, nh),
        ctx1 = canvas.getContext('2d'),
        ctx2 = scaledCanvas.getContext('2d'),
        imdata
    ;
    ctx1.createImageData(w, h);
    imdata = ctx1.getImageData(0, 0, w, h);
    imdata.data.set(data); // not supported in Opera, IE, Safari
    ctx1.putImageData(imdata,0,0);
    ctx2.drawImage(canvas,0,0,w,h,0,0,nw,nh); // scale
    return new IMGcpy( ctx2.getImageData(0, 0, nw, nh).data );
};*/
FilterImage.scale = FilterImage.resize = FILTER.Math.bilinear/*bicubic*/;

//
//
// Scaled Image (Proxy) Class
var FilterScaledImage = FILTER.ScaledImage = FILTER.Class( FilterImage, {
    name: "ScaledImage"
    
    ,constructor: function( scalex, scaley, img ) {
        var self = this;
        // factory-constructor pattern
        if ( !(self instanceof FilterScaledImage) ) return new FilterScaledImage(scalex, scaley, img);
        self.scaleX = scalex || 1;
        self.scaleY = scaley || self.scaleX;
        self.$super('constructor', img);
    }
    
    ,scaleX: 1
    ,scaleY: 1
    
    ,dispose: function( ) {
        var self = this;
        self.scaleX = null;
        self.scaleY = null;
        self.$super('dispose');
        return self;
    }
    
    ,clone: function( original ) {
        return new FilterScaledImage(this.scaleX, this.scaleY, true === original ? this.iCanvas : this.oCanvas);
    }
    
    ,setScale: function( sx, sy ) {
        var self = this, argslen = arguments.length;
        if (argslen > 0 && null != sx) 
        {
            self.scaleX = sx;
            self.scaleY = sx;
        }
        if (argslen > 1 && null != sy) 
            self.scaleY = sy;
        return self;
    }
    
    ,setImage: function( img ) {
        if ( !img ) return this;
        
        var self = this, ictx, octx, w, h, 
            sw, sh, sx = self.scaleX, sy = self.scaleY,
            isFilterImage, isVideo, isCanvas, isImage//, isImageData
        ;
        
        isFilterImage = img instanceof FilterImage;
        if ( isFilterImage ) img = img.oCanvas;
        isVideo = img instanceof HTMLVideoElement;
        isCanvas = img instanceof HTMLCanvasElement;
        isImage = img instanceof Image;
        //isImageData = img instanceof Object || "object" === typeof img;
        
        if ( isVideo )
        {
            w = img.videoWidth;
            h = img.videoHeight;
        }
        else
        {
            w = img.width;
            h = img.height;
        }
        
        if ( isImage || isCanvas || isVideo ) 
        {
            sw = ~~(sx*w + 0.5);
            sh = ~~(sy*h + 0.5);
            _setDimensions(self, sw, sh, WIDTH_AND_HEIGHT);
            if ( self._restorable ) 
            {
            ictx = self.ictx = self.iCanvas.getContext('2d');
            ictx.drawImage(img, 0, 0, w, h, 0, 0, sw, sh);
            }
            octx = self.octx = self.oCanvas.getContext('2d');
            octx.drawImage(img, 0, 0, w, h, 0, 0, sw, sh);
            self._needsRefresh |= DATA | HIST | SAT | SPECTRUM;
            if (self.selection) self._needsRefresh |= SEL;
        }
        //self.webgl = FILTER.useWebGL ? new FILTER.WebGL(self.domElement) : null;
        return self;
    }
});

}(FILTER);