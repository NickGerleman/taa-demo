# Temporal Antialisaing

This is a simple demo of a temporal antialiasing solution I created. This was created for final project in Computer Graphics taken Fall 2016. Some simple keyboard controls are available by looking at the code in Demo.js (These were stolen from example code used by the professor). 

The temporal antialiasing solution uses motion vector reprojection and simple 3x3 neighbor clamping. There is some artifacting and a slightly blurry look but this implementation is very effective in dealing with specular aliasing and looks decent in motion.

[Try it out here!](https://cdn.rawgit.com/NickGerleman/taa-demo/master/Demo.html)

![Demo Image](http://i.imgur.com/hYhDbBv.png)

##### Resources
- [TAA in Unreal Engine](https://de45xmedrsdbp.cloudfront.net/Resources/files/TemporalAA_small-59732822.pdf)
- [TAA in Uncharted 4 (200MB!)](http://advances.realtimerendering.com/s2016/s16_Ke.pptx)
- [TAA in Assasin's Creed 4](https://bartwronski.com/2014/03/15/temporal-supersampling-and-antialiasing/)