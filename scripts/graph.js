(function() {
    //Initialisation variables globales
    let nodes = [], //Les noeuds
        links = [], //Les arcs
        graphObj = {}, //Objet graphe des tableaux noeuds/liens
        gNodes, //Groupe visuel des noeuds
        gLinks, //Groupe visuel des liens (arcs),
        simulation, //Objet "forceSimulation" gérant les forces à l'oeuvre dans le graphe
        selectedEndpt, //point de terminaison SPARQL
        isUpdating = false; //Graphe en cours de mise à jour

    const svg = d3.select("#lesvg"),
        width = $("#lesvg").width(),
        height = $("#lesvg").height();

    //Zoom
    let transform = d3.zoomIdentity;
    const zoom = d3
        .zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", zoomed);
    svg.call(zoom).on("dblclick.zoom", null);

    function zoomed() {
        transform = d3.zoomTransform(this);
        gLinks.attr(
            "transform",
            "translate(" +
            transform.x +
            "," +
            transform.y +
            ") scale(" +
            transform.k +
            ")"
        );
        gNodes.attr(
            "transform",
            "translate(" +
            transform.x +
            "," +
            transform.y +
            ") scale(" +
            transform.k +
            ")"
        );
    }

    //Attribution d'un groupe par point de terminaison (endpoint)
    let endpointGroups = {};
    //Schéma de couleurs pour les groupes (points de terminaison)
    let coulGroupe = d3.scaleOrdinal().domain(Object.keys(endpointGroups)).range(d3.schemeTableau10);
    let options = document.querySelectorAll("select option");
    for (let i = 1; i < options.length; i++) {
        let option = options[i];
        if (option.value != "") {
            endpointGroups[option.value] = String.fromCharCode(65 + i);
            let coulOption = coulGroupe(endpointGroups[option.value]);
            option.style.color = coulOption; //La couleur associée au point de terminaison sélectionné.
            option.style.fontWeight = "bold";
        }
    }

    //Bordure autour du "select" pour refléter la couleur attribuée à l'endPoint
    //lors du changement d'option.
    const selectPterm = document.getElementById('selectPterm');
    selectPterm.addEventListener('change', function() {
        $("#selectPterm").css("background-color", "");
        const selectedOption = this.options[this.selectedIndex];
        const selectedValue = selectedOption.value;
        const coulOption = coulGroupe(endpointGroups[selectedValue]);
        const uriVal = $("#uri").val();
        this.style.borderStyle = "solid";
        this.style.borderWidth = "4px";
        this.style.borderColor = coulOption; //La couleur associée au point de terminaison sélectionné.

        if (!uriVal.length && selectedValue.indexOf("data.bnf") > -1) {
            //URI "exemple" à utiliser avec data.bnf (Paris)
            $("#uri").val("http://data.bnf.fr/ark:/12148/cb152821567")
        }
        if (selectedValue.indexOf("dbpedia") > -1) {
            //Mettre la couleur d'arrière plan (associée au point de terminaison) sur le select.
            const opacite = 0.5;
            const r = parseInt(coulOption.substring(1, 3), 16);
            const g = parseInt(coulOption.substring(3, 5), 16);
            const b = parseInt(coulOption.substring(5, 7), 16);
            const couleurAvecOpacite = `rgba(${r}, ${g}, ${b}, ${opacite})`;
            $("#selectPterm").css("background-color", couleurAvecOpacite);
            if (!uriVal.length) //URI "exemple" à utiliser avec dbpedia (J.S. Bach)
                $("#uri").val("https://fr.dbpedia.org/resource/Jean-Sébastien_Bach")
        }
        if (selectedValue.indexOf("europeana") > -1) {
            //Mettre la couleur d'arrière plan (associée au point de terminaison) sur le select.
            const opacite = 0.5;
            const r = parseInt(coulOption.substring(1, 3), 16);
            const g = parseInt(coulOption.substring(3, 5), 16);
            const b = parseInt(coulOption.substring(5, 7), 16);
            const couleurAvecOpacite = `rgba(${r}, ${g}, ${b}, ${opacite})`;
            $("#selectPterm").css("background-color", couleurAvecOpacite);
            if (!uriVal.length) //URI "exemple" à utiliser avec europeana (Pierre Corneille)
                $("#uri").val("http://dbpedia.org/resource/Pierre_Corneille")
        }
    });

    $("#envoi").on("click", function() {
        if (isUpdating) {
            return; //ignorer pendant la mise à jour du graphe
        }
        let uri = $("#uri").val();
        //Pas de https dans les URIs "data bnf" ou "dbpedia"
        if (uri.indexOf("data.bnf.fr/ark:") > -1 || uri.indexOf("fr.dbpedia.org") > -1)
        //Si c'est le cas, remplace https par http
            uri = uri.replace("https", "http");
        if (nodes.length) { //Si le tableau des noeuds n'est pas vide (pas la première requête)
            sparqlData(uri); //update
            return false;
        }
        //Le point de terminaison sélectionné.
        $("select option:selected").each(function() {
            selectedEndpt = $(this).text();
        });

        if (selectedEndpt.indexOf("Sélectionner") < 0 && $("#uri").val().trim().length) {
            //Définition des forces
            simulation = d3
                .forceSimulation()
                .force(
                    "center",
                    d3.forceCenter(width / 2 - 100, height / 2 - 100).strength(0.01)
                )
                .force("collide", d3.forceCollide(1))
                .force("charge", d3.forceManyBody().strength(-500))
                .force(
                    "link",
                    d3
                    .forceLink()
                    .id(d => d.uri)
                    .distance(function() {
                        return 150;
                    })
                    .strength(0.8)
                )
                .alphaTarget(0.05);

            sparqlData(uri);

        } else if (selectedEndpt.indexOf("Sélectionner") > -1) {
            $("#selectTerm").focus();
        } else if (!$("#uri").val().trim().length) {
            $("#uri").focus();
        }
    });

    //"écouteur" pour appui sur la touche entrée dans le champ URI
    $("#uri").on("keyup", function(event) {
        if (event.keyCode === 13) {
            $("#uri").blur();
            $("#envoi").click();
        }
    });

    function sparqlData(uri) {
        isUpdating = true;
        //Animation du logo (loader)
        let loader = document.querySelector('.loader-svg');
        loader.style.animationPlayState = 'running';
        //Le point de terminaison sélectionné.
        $("select option:selected").each(function() {
            selectedEndpt = $(this).text();
        });
        if (selectedEndpt.indexOf("Sélectionner") < 0 && $("#uri").val().trim().length) {
            //Requête SPARQL
            const Query =
                `
                PREFIX owl: <http://www.w3.org/2002/07/owl#>
                PREFIX foaf: <http://xmlns.com/foaf/0.1/>
                PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
                PREFIX dc: <http://purl.org/dc/elements/1.1/>
                SELECT DISTINCT * WHERE{
                { <${uri}> ?p2 ?o.                
                OPTIONAL {?o rdf:type ?type.}
                OPTIONAL {?o dc:type ?type.}
                OPTIONAL {<${uri}> rdf:type ?uriType.}
                OPTIONAL{ ?o foaf:depiction ?depic.}}
                UNION 
                { ?s ?p1 <${uri}>.
                OPTIONAL {?s rdf:type ?type.}
                OPTIONAL {?s dc:type ?type.}
                OPTIONAL {<${uri}> rdf:type ?uriType.}
                OPTIONAL{ ?s foaf:depiction ?depic.}}
                FILTER (!exists{?s owl:SameAs ?o})}
                ORDER BY RAND() LIMIT 100`;

            $("#req").html(
                `<h3>Dernière requête effectuée sur <b style="color:${coulGroupe(endpointGroups[selectedEndpt])};">${selectedEndpt}</b> :</h3>
                <pre>${Query.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</pre>`
            );

            //Paramétrage et envoi de la requête au point de terminaison (fetch).
            let url = new URL(selectedEndpt),
                params = {
                    queryLn: "SPARQL",
                    output: "json",
                    query: Query,
                    limit: "none",
                    infer: "true",
                    headers: {
                        'Content-Type': 'application/sparql-query',
                        'Accept': 'application/sparql-results+json'
                    }
                };
            Object.keys(params).forEach((key) =>
                url.searchParams.append(key, params[key])
            );
            fetch(url)
                .then((reponse) => reponse.json())
                .then((data) => traitSPARQL(uri, data, selectedEndpt))
                .catch((err) => console.log(err));
        }
    }

    //Traitement de la réponse du serveur.
    function traitSPARQL(uri, response, endPt) {
        //"reset" du SVG à chaque update
        d3.selectAll("#lesvg > *").remove();
        d3.selectAll(".tooltip").remove();

        $("#req").append(
            "<br><br><h4>" +
            response.results.bindings.length +
            " triplets chargés</h4>"
        );

        //Groupe des liens
        gLinks = svg.append("g");
        //Groupe des noeuds
        gNodes = svg.append("g");
        //"markers" pour les flèches directionnelles sur les liens
        gLinks
            .append("#lesvg:defs")
            .selectAll("marker")
            .data(["end"])
            .enter()
            .append("#lesvg:marker")
            .attr("id", String)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 33)
            .attr("markerUnits", "userSpaceOnUse")
            .attr("markerWidth", 8)
            .attr("markerHeight", 8)
            .attr("orient", "auto")
            .append("#lesvg:polyline")
            .attr("points", "0,-5 10,0 0,5")
            .attr("fill", "#999");

        let triplet = ""; //triplet correspondant pour chaque "statement"
        $("#trplt").html("");
        let c = 0; //Compteur d'itérations
        //Itération des résultats
        response.results.bindings.forEach((element) => {
            //L'URI est utilisé comme objet s'il n'est pas sujet
            //Dans le cas où l'URI est sujet, la valeur par défaut est une chaîne vide
            let sujet = element.hasOwnProperty('s') ? element.s.value : uri;
            let predicat = element.hasOwnProperty('p1') ? element.p1.value : element.p2.value;
            let objet = element.hasOwnProperty('o') ? element.o.value : (sujet === uri ? '' : uri);

            if (element.hasOwnProperty('p1') && element.hasOwnProperty('p2')) {
                //Les résultats contiennent à la fois p1 et p2, on utilise p1 par défaut, mais on vérifie
                //s'il existe plusieurs valeurs associées à p1 ou p2 pour le prédicat
                if (Array.isArray(element.p1)) {
                    predicat = element.p1[0].value;
                }
                if (Array.isArray(element.p2)) {
                    predicat = element.p2[0].value;
                }
            }

            let typeO = objet !== uri && typeof element.type !== "undefined" ? element.type.value : objet;
            let typeS = sujet !== uri && typeof element.type !== "undefined" ? element.type.value : sujet;

            let coulTypeS = getColorType(typeS, selectedEndpt);
            let coulTypeO = getColorType(typeO, selectedEndpt);


            let bColorS = coulTypeS.couleur;
            const fColorS = frontColor(bColorS);
            let bColorO = coulTypeO.couleur;
            const fColorO = frontColor(bColorO);

            triplet = `<span style='background-color:${bColorS}; color: ${fColorS}; border-radius: 10px; padding:5px;'>&lt;${sujet}&gt;</span><br><b>&#x279F;</b> <span style='background-color:#555; color: white; border-radius: 10px; padding:5px;'>&lt;${predicat}&gt;</span><br><b>&#x279F;</b> <span style='background-color:${bColorO}; color: ${fColorO}; border-radius: 10px; padding:5px;'>&lt;${objet}&gt;</span>`;

            let stringHtml =
                `<span style='color:${bColorS}; font-weight:bold;'>&lt;${sujet}&gt;</span> <span style='color:#555'>&lt;${predicat}&gt;</span> <span style='color:${bColorO}; font-weight:bold;'>&lt;${objet}&gt;</span>`;

            $("#trplt").append(`<small>${stringHtml}</small><br>`);

            if (c === 0) { //Première itération, on traite l'URI
                let uriType = typeof element.uriType === "undefined" ? "pas de type" : element.uriType.value
                let coulTypeURI = getColorType(uriType, endPt)
                nodes.push({
                    modelType: coulTypeURI.type,
                    label: coulTypeURI.label,
                    rdfType: uriType,
                    type: "uri",
                    uri: uri,
                    isLiteral: uriType.indexOf("literal") > -1 ? true : false,
                    pred: predicat,
                    triplet: triplet,
                    couleur: coulTypeURI.couleur,
                    depic: element.hasOwnProperty("depic") ? element.depic.value : "",
                    group: endpointGroups[endPt]
                });
            } else {
                //URI tantôt sujet tantôt objet
                if (typeof element.o === "undefined") { //L'élément considéré est sujet
                    nodes.push({
                        modelType: coulTypeS.type,
                        label: coulTypeS.label,
                        rdfType: element.s.type,
                        type: "sujet",
                        uri: sujet,
                        isLiteral: element.s.type.indexOf("literal") > -1 ? true : false,
                        pred: predicat,
                        triplet: triplet,
                        couleur: bColorS,
                        depic: element.hasOwnProperty("depic") ? element.depic.value : "",
                        group: endpointGroups[endPt]
                    });
                    nodes.push({
                        modelType: coulTypeO.type,
                        label: coulTypeO.label,
                        rdfType: "",
                        type: "objet",
                        uri: uri,
                        isLiteral: false,
                        pred: predicat,
                        triplet: triplet,
                        couleur: bColorO,
                        depic: element.hasOwnProperty("depic") ? element.depic.value : "",
                        group: endpointGroups[endPt]
                    });
                    links.push({
                        source: sujet,
                        target: uri,
                        value: predicat
                    });
                } else { //L'élément considéré est objet
                    nodes.push({
                        modelType: coulTypeO.type,
                        label: coulTypeO.label,
                        rdfType: element.o.type,
                        type: "objet",
                        uri: objet,
                        isLiteral: element.o.type.indexOf("literal") > -1 ? true : false,
                        pred: predicat,
                        triplet: triplet,
                        couleur: bColorO,
                        depic: element.hasOwnProperty("depic") ? element.depic.value : "",
                        group: endpointGroups[endPt]
                    });
                    nodes.push({
                        modelType: coulTypeS.type,
                        label: coulTypeS.label,
                        rdfType: "",
                        type: "sujet",
                        uri: uri,
                        isLiteral: false,
                        pred: predicat,
                        triplet: triplet,
                        couleur: bColorS,
                        depic: element.hasOwnProperty("depic") ? element.depic.value : "",
                        group: endpointGroups[endPt]
                    });
                    links.push({
                        source: uri,
                        target: objet,
                        value: predicat
                    });
                }
            }
            c++
        });

        //"nettoyage"
        let newNodes = supprDoublons(nodes, "uri"); //Tableau des noeuds uniques
        graphObj = {
            nodes: newNodes,
            links: links,
        };

        //Si à ce stade il y a des noeuds... on gère la création du graphe
        if (nodes.length) {
            //"div" popup
            const div = d3.select("body").append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);

            //Les liens
            let link = gLinks
                .attr("class", "link")
                .selectAll("line")
                .data(graphObj.links);

            const linkEnter = link
                .enter()
                .append("line")
                .attr("stroke-width", 0.8)
                .attr("stroke", () => "#555")
                .attr("marker-end", "url(#end)");

            link = linkEnter.merge(link);

            //Les noeuds
            let node = gNodes
                .attr("class", "nodes")
                .selectAll("circle")
                .data(graphObj.nodes);

            const nodeEnter = node.enter()
                .append("circle")
                .attr("r", d => 18)
                .attr("fill", d => {
                    if (d.group === "B") {
                        //Si la source est la BnF (2ème option), on renvoie la couleur associée selon la correspondance IFLA-LRM
                        return d.couleur
                    } else {
                        //Sinon, on met la couleur du groupe (endpoint) à 50% et on renvoie cette couleur
                        const couleur = coulGroupe(d.group);
                        const opacite = 0.5;

                        // Convertir la valeur hexadécimale en valeurs RVB
                        const r = parseInt(couleur.substring(1, 3), 16);
                        const g = parseInt(couleur.substring(3, 5), 16);
                        const b = parseInt(couleur.substring(5, 7), 16);

                        // Renvoyer la couleur avec une opacité de 0.5
                        const couleurAvecOpacite = `rgba(${r}, ${g}, ${b}, ${opacite})`;
                        return couleurAvecOpacite;
                    }
                })
                .attr("pointer-events", "all")
                .attr("stroke", d => coulGroupe(d.group))
                .attr("stroke-width", "3")
                .call(drag(simulation));

            //Troncature du texte du label en fonction de la longueur de la chaine (littéral)
            //et du rayon d'un cercle (noeud)
            function troncatureLabel(text, maxLength, radius) {
                const circonf = 2 * Math.PI * radius;
                const averageCharWidth = circonf / maxLength;
                const maxChars = Math.floor(radius / averageCharWidth);
                return text.length > maxChars ? text.slice(0, maxChars) + '...' : text;
            }

            //Variation de la taille de police en fonction de la longueur du texte
            function taillePolice(text, maxSize) {
                // Longueur du texte
                const textLength = text.length;
                // Taille de police en fonction de la longueur du texte
                let fontSize = Math.min(maxSize, Math.max(8, maxSize - (textLength * 0.5)));
                return fontSize + "px";
            }


            const labels = node.enter().append("text")
                .html(d => {
                    if (d.isLiteral) {
                        let literal = troncatureLabel(d.uri, 80, 18);
                        let fontSize = taillePolice(literal, 12);
                        return `<tspan text-anchor="middle" dominant-baseline="central" font-size="${fontSize}">${literal}</tspan>`
                    } else {
                        let type = d.label;
                        let fontSize = taillePolice(type, 12);
                        return `<tspan text-anchor="middle" dominant-baseline="central" font-size="${fontSize}">${type}</tspan>`
                    }
                })
                .style("fill", "rgb(51, 51, 51)")
                .attr("pointer-events", "none");

            nodeEnter.on("dblclick", function(event, d) {
                if (isUpdating) { //Si en cours de màj...
                    return; //ignorer le double clic
                }
                if (!d.isLiteral) { //Màj uniquement s'il ne s'agit pas d'un littéral
                    $("#uri").val(d.uri);
                    sparqlData(d.uri);
                }
            });

            nodeEnter.on("mouseover", function(event, d) {
                    //l'URI de l'entité est elle une image ?
                    //Auquel cas on l'utilise pour l'illustration dans le cartouche "popup".
                    let depic = d.uri.indexOf(".thumbnail") > -1 || d.uri.indexOf(".jpg") > -1 ? d.uri : d.depic;
                    //depic est l'image liée à l'entité (foaf:depiction).
                    //On décode pour éviter les %25 dans l'UI (/)
                    let decodedUri = decodeURIComponent(depic);
                    let depiction = decodedUri.length ? `<img src='${decodedUri}' style='float:left; margin-right: 5px;height:70px;' />` : "";

                    //div est un cartouche "popup" qui va afficher l'URI de la ressource, son "type",
                    //une image d'illustration liée s'il y en a une, et le triplet qui lie cette ressource.
                    //Des codes couleur correspondants au "type" sont utilisés pour la couleur du texte.
                    div.style("border", "solid 5px" + coulGroupe(d.group));

                    div.transition()
                        .duration(100)
                        .style("opacity", .95);


                    div.html(`<div style='background-color:#888; padding:5px; border-radius: 10px; border:1px solid ${d.couleur}; margin-bottom:1em;'>${depiction}
                    <h6 style='margin-bottom:0.1em; color:${d.couleur};'><b>&lt;${d.uri}</b>&gt;</h6>      <small>(${d.modelType})</small>
                    </div>
                    <p>${d.triplet}</p>`)
                        .style("left", (event.pageX) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    div.transition()
                        .duration(200)
                        .style("opacity", 0);
                });

            node = nodeEnter.merge(node);

            //Légende des types exposés par le graphe

            //Nombre de types exposés par le graphe
            let typeCounts = graphObj.nodes.reduce((counts, node) => {
                counts[node.modelType] = (counts[node.modelType] || 0) + 1;
                return counts;
            }, {});

            //Les types uniques dans le graphe
            let uniqueModelTypes = supprDoublons(graphObj.nodes, "modelType");

            let legende = d3.select("#legende-container");
            let legendeItems = legende.selectAll(".legende-item").data(uniqueModelTypes, d => d.modelType);

            legendeItems.join(
                enter => {
                    enter.append("span")
                        .attr("class", "legende-item")
                        .style("background-color", d => d.couleur)
                        .style("color", d => frontColor(d.couleur))
                        .text(d => `${d.modelType} (${typeCounts[d.modelType]})`)
                },
                update => {
                    update.style("background-color", d => d.couleur)
                        .style("color", d => frontColor(d.couleur))
                        .text(d => `${d.modelType} (${typeCounts[d.modelType]})`)
                },
                exit => exit.remove()
            );

            link.exit().remove();
            node.exit().remove();
            labels.exit().remove();
            div.exit().remove();

            //Refresh de la simulation à ce stade, car elle se fige parfois.
            simulation.alpha(0.1).restart();

            simulation.nodes(graphObj.nodes);
            simulation.force("link").links(graphObj.links);

            simulation.on("tick", ticked);
            //simulation.on("end", function() {});

            //Réinitialise le svg avec la valeur précédente de zoomTransform
            svg.call(zoom.transform, transform);

            //Une fois le graphe chargé, pause de l'animation du logo (loader)
            let loader = document.querySelector('.loader-svg');
            loader.style.animationPlayState = 'paused';
            isUpdating = false;

            //Fonction itération d3
            function ticked() {
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);

                node
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y);

                labels
                    .attr("dx", d => d.x)
                    .attr("dy", d => d.y);
            }

            function drag(simulation) {
                function dragstarted(event) {
                    if (!event.active)
                        simulation.alphaTarget(0.1).restart();
                    event.subject.fx = event.subject.x;
                    event.subject.fy = event.subject.y;
                }

                function dragged(event) {
                    event.subject.fx = event.x;
                    event.subject.fy = event.y;
                }

                function dragended(event) {
                    if (!event.active)
                        simulation.alphaTarget(0);
                    event.subject.fx = null;
                    event.subject.fy = null;
                }

                return d3
                    .drag()
                    .on("start", dragstarted)
                    .on("drag", dragged)
                    .on("end", dragended);
            }
        } else {
            let loader = document.querySelector('.loader-svg');
            loader.style.animationPlayState = 'paused';
            isUpdating = false;
        }

        //Fonction pour supprimer les doublons dans un tableau
        function supprDoublons(myArr, prop) {
            return myArr.filter((obj, pos, arr) => {
                let arrayMap =
                    arr.map((mapObj) => mapObj[prop]).indexOf(obj[prop]) === pos;
                return arrayMap;
            });
        }

        //Couleur en fonction du type d'entité.
        //Les couleurs sont choisies pour être en adéquation avec les choix faits par la Transition Bibliographique
        function getColorType(type, source) {
            if (source.indexOf("bnf") > -1) {
                //Nomen
                if (
                    type.indexOf("#P61160") > -1 ||
                    type.indexOf("#P30176") > -1 ||
                    type.indexOf("publishersName") > -1 ||
                    type.indexOf("foaf/0.1/name") > -1 ||
                    type.indexOf("foaf/0.1/givenName") > -1 ||
                    type.indexOf("foaf/0.1/familyName") > -1) {
                    return { couleur: "#cbbba1", label: "Nomen", type: "Nomen" };
                }
                if ( //Genre/Forme
                    type.indexOf("vocabulary/work-form") > -1 ||
                    type.indexOf("Elements/formOfWork") > -1 ||
                    (type.indexOf("dc/dcmitype/") > -1 && type.indexOf("Event") < 0)
                ) {
                    return { couleur: "#fcc1fb", label: type.substring(type.lastIndexOf("/") + 1), type: "Genre/Forme" };
                }
                //Expression
                if (type.indexOf("Expression") > -1 ||
                    type.indexOf("expressionOfWork") > -1 ||
                    type.indexOf("#P30139") > -1 ||
                    type.indexOf("#P10078") > -1 ||
                    type.indexOf("#C10006") > -1) {
                    return { couleur: "#ff9900", label: "Expression", type: "Expression" };
                }
                if ( //Concept
                    type.indexOf("/skos/") > -1 ||
                    type.indexOf("#seeAlso") > -1 ||
                    type.indexOf("related") > -1 ||
                    type.indexOf("broader") > -1 ||
                    type.indexOf("closeMatch") > -1 ||
                    type.indexOf("exactMatch") > -1 ||
                    type.indexOf("relatedMatch") > -1 ||
                    type.indexOf("dc/terms/subject") > -1 ||
                    type.indexOf("ontology/bnf-onto/domaine ") > -1 ||
                    type.indexOf("narrower") > -1
                ) {
                    return { couleur: "#f580f4", label: "Concept", type: "Concept" };
                }
                if ( //Work
                    type.indexOf("FRBRentitiesRDA/Work") > -1 ||
                    type.indexOf("rbr/core#term-Work") > -1 ||
                    type.indexOf("#C10001") > -1 ||
                    type.indexOf("bibo/Periodical") > -1 ||
                    type.indexOf("#frbr:Work") > -1 ||
                    type.indexOf("human-music.eu/work") > -1 ||
                    type.indexOf("musicbrainz.org/work") > -1 ||
                    type.indexOf("temp-work") > -1 ||
                    type.indexOf("#P10004") > -1 ||
                    type.indexOf("Work") > -1
                ) {
                    return { couleur: "#c00000", label: "Oeuvre", type: "Oeuvre" };
                }
                if ( //Evénement
                    type.indexOf("Event") > -1 ||
                    type.indexOf("frbr/core#term-Event") > -1 ||
                    type.indexOf("frbr/core#Event") > -1
                ) {
                    return { couleur: "#937efc", label: "Événement", type: "Événement" };
                }
                if ( //Manifestation
                    type.indexOf("FRBRentitiesRDA/Manifestation") > -1 ||
                    type.indexOf("#P30135") > -1 ||
                    type.indexOf("#P30133") > -1 ||
                    type.indexOf("expressionManifested") > -1 ||
                    type.indexOf("workManifested") > -1 ||
                    type.indexOf("#C10007") > -1 ||
                    type.indexOf("#P30016") > -1
                ) {
                    return { couleur: "#92d050", label: "Manifestation", type: "Manifestation" };
                }
                if ( //Laps de temps
                    type.indexOf("owl-time/Instant") > -1 ||
                    type.indexOf("dc/terms/created") > -1 ||
                    type.indexOf("dc/terms/modified") > -1 ||
                    type.indexOf("/date") > -1 ||
                    type.indexOf("isniAttributionDate") > -1 ||
                    type.indexOf("#P30011") > -1 ||
                    type.indexOf("firstYear") > -1 ||
                    type.indexOf("lastYear") > -1 ||
                    type.indexOf("#P10219") > -1 ||
                    type.indexOf("bio/0.1/death") > -1 ||
                    type.indexOf("bio/0.1/birth") > -1 ||
                    type.indexOf("#P50121") > -1 ||
                    type.indexOf("#P50120") > -1
                ) {
                    return { couleur: "#ffcc66", label: "Laps de temps", type: "Laps de temps" };
                }
                if ( //Collectivité
                    type.indexOf("foaf/0.1/#term_Organization") > -1 ||
                    type.indexOf("foaf/0.1/Organization") > -1 ||
                    type.indexOf("isniAttributionAgency") > -1 ||
                    type.indexOf("dc/terms/publisher") > -1 ||
                    type.indexOf("roles/r360") > -1 ||
                    type.indexOf("MusicGroup") > -1 ||
                    type.indexOf("Organisation") > -1
                ) {
                    return { couleur: "#4394c3", label: "Collectivité", type: "Collectivité" };
                }
                if ( //Personne
                    type.indexOf("isni") > -1 ||
                    type.indexOf("Person") > -1 ||
                    type.indexOf("musicbrainz.org/artist") > -1 ||
                    type.indexOf("human-music.eu/person") > -1 ||
                    type.indexOf("authorities") > -1 ||
                    type.indexOf("creator") > -1 ||
                    type.indexOf("roles/r70") > -1 ||
                    type.indexOf("roles/r440") > -1 ||
                    type.indexOf("relators/aut") > -1 ||
                    type.indexOf("NaturalPerson") > -1 ||
                    type.indexOf("Artist") > -1 ||
                    type.indexOf("Agent") > -1
                ) {
                    return { couleur: "#315fba", label: "Personne", type: "Personne" };
                }
                if (type.indexOf("bnf-onto/ExpositionVirtuelle") > -1) { //Exposition
                    return { couleur: "#d2cafc", label: "Exposition", type: "Exposition" };
                }
                if ( //Lieu
                    type.indexOf("/countries") > -1 ||
                    type.indexOf("wgs84_pos") > -1 ||
                    type.indexOf("geonames.org") > -1 ||
                    type.indexOf("data.ign.fr/") > -1 ||
                    type.indexOf("insee.fr") > -1 ||
                    type.indexOf("geonames") > -1 ||
                    type.indexOf("countryAssociatedWithThePerson") > -1 ||
                    type.indexOf("Place") > -1 ||
                    type.indexOf("Country") > -1 ||
                    type.indexOf("Location") > -1 ||
                    type.indexOf("City") > -1 ||
                    type.indexOf("Settlement") > -1 ||
                    type.indexOf("Q486972") > -1 ||
                    type.indexOf("Q3957") > -1 ||
                    type.indexOf("Q6256") > -1
                ) {
                    return { couleur: "#99a6ae", label: "Lieu", type: "Lieu" };
                } else { //Si rien ne correspond on renvoie une couleur grise et le dernier élément de l'URI qui peut être précédé de "/", ".", ou "#"
                    var parts = type.split(/[/.#]/); //Divise le type en fonction de "/", "." ou "#"
                    if (type.endsWith('/')) {
                        return { couleur: "#dddddd", label: parts[parts.length - 2] + "/".replace(/\/$/, ''), type: "nd" }; //Retourne l'avant-dernier élément avec le "/" final retiré
                    } else {
                        return { couleur: "#dddddd", label: parts[parts.length - 1], type: "nd" }; //Retourne le dernier élément de la liste résultante
                    }
                }
            } else { //Si la source n'est pas la BnF, donc si on n'est pas dans l'ontologie LRM,
                //on renvoie une couleur grise et le dernier élément de l'URI
                //qui peut être précédé de "/", ".", ou "#"
                console.log(type);
                var parts = type.split(/[/.#]/); //Divise le type en fonction de "/", "." ou "#"
                if (type.endsWith('/')) {
                    return { couleur: "#dddddd", label: parts[parts.length - 2] + "/".replace(/\/$/, ''), type: "nd" }; //Retourne l'avant-dernier élément avec le "/" final retiré
                } else {
                    return { couleur: "#dddddd", label: parts[parts.length - 1], type: "nd" }; //Retourne le dernier élément de la liste résultante
                }
            }

        }

        //Fonction renvoyant une couleur adéquate pour le texte (noir ou blanc) en fonction de la couleur d'arrière plan afin d'obtenir un contraste suffisant.
        function frontColor(hexcolor) {
            const r = parseInt(hexcolor.substring(1, 3), 16);
            const g = parseInt(hexcolor.substring(3, 5), 16);
            const b = parseInt(hexcolor.substring(5, 7), 16);
            const fc = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            return (fc >= 128) ? 'black' : 'white';
        }
    }
})();