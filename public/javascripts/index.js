RADIUS_MIN = 5;
RADIUS_MAX = 30;
gData = [];
gTypeSelect = $("#typeSelect");
gDateSelect = $("#dateSelect");
gTipDiv = null;
gCountryInfos = [];
gRadiusScale = null;

gValueTypes = {
    retention_rate: {valueName: "Retention Rate"},
    default: {valueName: "Value"}
};

function drawData(svg, contriesData, duration) {
    var values = contriesData.map(x => x.value);
    var colorScale = d3.scaleSqrt().domain([Math.min(...values), Math.max(...values)]).range(["lime", "red"]);
    var circles = svg.selectAll("circle").data(contriesData);

    circles.exit().remove();
    circles.enter()
        .append("circle")
        .on("mouseover", function(d) {
            var valueName = gValueTypes[gTypeSelect.find(':selected').data("value-type")].valueName;
            gTipDiv.transition()
                .duration(200)
                .style("opacity", 0.9);
            gTipDiv.html("Country: " + d.country + "<br/>" + valueName + ": " + d.value)
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            gTipDiv.transition()
                .duration(500)
                .style("opacity", 0);
        });

    circles = svg.selectAll("circle").data(contriesData);
    circles.attr("cx", function(d) {
            return d.info.x;
        })
        .attr("cy", function(d) {
            return d.info.y;
        })
        .style("fill", function(d) {
            return colorScale(d.value);
        })
        .attr("r", function(d) {
            var r = 1;
            if (d.info.value != null)
            {
                r = gRadiusScale(d.info.value);
            }
            d.info.value = d.value;
            return r;
        })
        .style("opacity", 0.7)
        .transition().duration(duration)
        .attr("r", function(d) {
            return gRadiusScale(d.value);
        });
}

function requestData(url) {
    $.get(url, function(response){
        gData = [];
        var min = Number.POSITIVE_INFINITY;
        var max = Number.NEGATIVE_INFINITY;
        $.each(response.data, function (i, item) {
            var values = [];
            for (var i = 0; i < item.values.length; i++) {
                if (!(item.values[i].country.toLowerCase() in gCountryInfos)) {
                    console.log("Ignore " + item.values[i].country);
                    continue;
                }
                min = Math.min(min, item.values[i].value);
                max = Math.max(max, item.values[i].value);
                item.values[i].info = gCountryInfos[item.values[i].country.toLowerCase()];
                item.values[i].info.value = null;
                values.push(item.values[i]);
            }

            if (values.length > 0) {
                gData.push({date: item.date, values: values})
                gDateSelect.append($('<option>', {
                    text : item.date
                }));
                gRadiusScale = d3.scaleLinear()
                                .domain([min, max])
                                .range([RADIUS_MIN, RADIUS_MAX]);
            }
        });
        gDateSelect.change();
    });
}

d3.json("/data/custom.geo.json", function(error, geographicData) {
    if (error) return console.warn(error);

    var radiusScale = d3.scaleSqrt()
        .domain([-5.4, 500])
        .range([10, 55]);
    
    var margin = 75,
        width = $(window).width() - margin,
        height = $(window).height() - margin;
    console.log($(document).width());
    console.log($(document).height());

    // add the main svg element to the body of the page
    var svg = d3.select("body")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background-color", "steelblue")
        .attr("transform", "translate(20,20)")
        .append("g")
        .attr("class", "map");

    // create the projection 
    var projection = d3.geoNaturalEarth()
        .scale(230)
        .translate([width / 2, height / 2]);

    // create a d3 path function 
    var path = d3.geoPath().projection(projection);

    // use d3's path function to draw a map from the geoJSON data
    var map = svg.selectAll("path")
        .data(geographicData.features)
        .enter()
        .append("path")
        .attr("d", path)
        .style("fill", "white")
        .style("stroke", "gray")
        .style("stroke-width", 0.8);

    // compute centroids of countries for locating data circles
    for (var i = 0; i < geographicData.features.length; i += 1) {
        var location = path.centroid(geographicData.features[i]);
        var info = {x: location[0], y: location[1], index: i, value: null};
        gCountryInfos[geographicData.features[i].properties.name.toLowerCase()] = info;
        gCountryInfos[geographicData.features[i].properties.name_long.toLowerCase()] = info;
    }

    gTipDiv = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    gTypeSelect.change(function() {
        gDateSelect.empty();
        requestData($(this).val());
    });

    gDateSelect.change(function() {
        var data = gData[this.selectedIndex];
        drawData(svg, data.values, 500);
    });

    gTypeSelect.change();
});