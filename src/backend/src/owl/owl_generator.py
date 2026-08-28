"""OWL ontology generator.

Extracted from OntoBricks. Generates OWL ontologies in Turtle format from
Python dicts (classes, properties, constraints, axioms, SWRL rules).
"""

import json
import re
from typing import Dict, List

from rdflib import BNode, Graph, Literal, Namespace, URIRef
from rdflib.collection import Collection
from rdflib.namespace import OWL, RDF, RDFS, XSD

from src.common.logging import get_logger

logger = get_logger(__name__)

ONTOBRICKS_NS = Namespace("http://ontobricks.com/schema#")


class OntologyGenerator:
    """Generate OWL ontologies from configuration."""

    def __init__(
        self,
        base_uri: str,
        ontology_name: str,
        classes: List[Dict],
        properties: List[Dict],
        constraints: List[Dict] = None,
        swrl_rules: List[Dict] = None,
        axioms: List[Dict] = None,
    ):
        self.base_uri = base_uri.rstrip("#") + "#"
        self.ontology_name = ontology_name
        self.classes = classes or []
        self.properties = properties or []
        self.constraints = constraints or []
        self.swrl_rules = swrl_rules or []
        self.axioms = axioms or []

        self.graph = Graph()
        self.ns = Namespace(self.base_uri)

        self.graph.bind("owl", OWL)
        self.graph.bind("rdf", RDF)
        self.graph.bind("rdfs", RDFS)
        self.graph.bind("xsd", XSD)
        self.graph.bind("ontobricks", ONTOBRICKS_NS)
        self.graph.bind("", self.ns)

    def generate(self) -> str:
        """Generate OWL content as Turtle string."""
        ontology_uri = URIRef(self.base_uri.rstrip("#"))
        self.graph.add((ontology_uri, RDF.type, OWL.Ontology))

        if self.ontology_name:
            self.graph.add((ontology_uri, RDFS.label, Literal(self.ontology_name)))

        for cls in self.classes:
            self._add_class(cls)

        for prop in self.properties:
            self._add_property(prop)

        for constraint in self.constraints:
            self._add_constraint(constraint)

        for rule in self.swrl_rules:
            self._add_swrl_rule(rule)

        for axiom in self.axioms:
            self._add_axiom(axiom)

        return self.graph.serialize(format="turtle")

    # ------------------------------------------------------------------
    # Constraints
    # ------------------------------------------------------------------

    def _add_constraint(self, constraint: Dict):
        """Add a property constraint to the ontology."""
        constraint_type = constraint.get("type", "")
        property_ref = constraint.get("property", "")
        class_ref = constraint.get("className", "")
        value = constraint.get("value") or constraint.get("cardinalityValue", "")
        value_class = constraint.get("valueClass", "")
        has_value = constraint.get("hasValue", "")

        if not constraint_type:
            return

        def get_uri(ref, is_property=False):
            if not ref:
                return None
            if ref.startswith("http://") or ref.startswith("https://"):
                return URIRef(ref)
            return URIRef(self.base_uri + ref)

        property_characteristics = {
            "functional": OWL.FunctionalProperty,
            "inverseFunctional": OWL.InverseFunctionalProperty,
            "transitive": OWL.TransitiveProperty,
            "symmetric": OWL.SymmetricProperty,
            "asymmetric": OWL.AsymmetricProperty,
            "reflexive": OWL.ReflexiveProperty,
            "irreflexive": OWL.IrreflexiveProperty,
        }

        if constraint_type in property_characteristics:
            if property_ref:
                prop_uri = get_uri(property_ref, is_property=True)
                self.graph.add((prop_uri, RDF.type, property_characteristics[constraint_type]))
            return

        if constraint_type in ["minCardinality", "maxCardinality", "exactCardinality"] and property_ref:
            self._add_cardinality_restriction_uri(constraint_type, get_uri(property_ref), get_uri(class_ref), value)
            return

        if constraint_type in ["allValuesFrom", "someValuesFrom"] and property_ref:
            target_class = value_class or value
            self._add_values_restriction_uri(constraint_type, get_uri(property_ref), get_uri(class_ref), get_uri(target_class))
            return

        if constraint_type == "hasValue" and property_ref:
            val = has_value or value
            self._add_has_value_restriction_uri(get_uri(property_ref), get_uri(class_ref), val)
            return

        if constraint_type == "valueCheck":
            self._add_value_check_constraint(constraint, get_uri)
            return

        if constraint_type == "globalRule":
            self._add_global_rule_constraint(constraint)
            return

    def _add_cardinality_restriction_uri(self, restriction_type: str, prop_uri: URIRef,
                                         class_uri: URIRef, value):
        if not class_uri or not prop_uri or value is None:
            return

        try:
            card_value = int(value)
        except (ValueError, TypeError):
            return

        class_local = str(class_uri).split("#")[-1].split("/")[-1]
        prop_local = str(prop_uri).split("#")[-1].split("/")[-1]

        restriction = URIRef(self.base_uri + f"_restriction_{class_local}_{prop_local}_{restriction_type}")

        self.graph.add((restriction, RDF.type, OWL.Restriction))
        self.graph.add((restriction, OWL.onProperty, prop_uri))

        if restriction_type == "minCardinality":
            self.graph.add((restriction, OWL.minCardinality, Literal(card_value, datatype=XSD.nonNegativeInteger)))
        elif restriction_type == "maxCardinality":
            self.graph.add((restriction, OWL.maxCardinality, Literal(card_value, datatype=XSD.nonNegativeInteger)))
        elif restriction_type == "exactCardinality":
            self.graph.add((restriction, OWL.cardinality, Literal(card_value, datatype=XSD.nonNegativeInteger)))

        self.graph.add((class_uri, RDFS.subClassOf, restriction))

    def _add_values_restriction_uri(self, restriction_type: str, prop_uri: URIRef,
                                     class_uri: URIRef, value_class_uri: URIRef):
        if not class_uri or not value_class_uri or not prop_uri:
            return

        class_local = str(class_uri).split("#")[-1].split("/")[-1]
        prop_local = str(prop_uri).split("#")[-1].split("/")[-1]

        restriction = URIRef(self.base_uri + f"_restriction_{class_local}_{prop_local}_{restriction_type}")

        self.graph.add((restriction, RDF.type, OWL.Restriction))
        self.graph.add((restriction, OWL.onProperty, prop_uri))

        if restriction_type == "allValuesFrom":
            self.graph.add((restriction, OWL.allValuesFrom, value_class_uri))
        elif restriction_type == "someValuesFrom":
            self.graph.add((restriction, OWL.someValuesFrom, value_class_uri))

        self.graph.add((class_uri, RDFS.subClassOf, restriction))

    def _add_has_value_restriction_uri(self, prop_uri: URIRef, class_uri: URIRef, value: str):
        if not class_uri or not value or not prop_uri:
            return

        class_local = str(class_uri).split("#")[-1].split("/")[-1]
        prop_local = str(prop_uri).split("#")[-1].split("/")[-1]

        restriction = URIRef(self.base_uri + f"_restriction_{class_local}_{prop_local}_hasValue")

        self.graph.add((restriction, RDF.type, OWL.Restriction))
        self.graph.add((restriction, OWL.onProperty, prop_uri))
        self.graph.add((restriction, OWL.hasValue, Literal(value)))

        self.graph.add((class_uri, RDFS.subClassOf, restriction))

    def _add_value_check_constraint(self, constraint: Dict, get_uri):
        class_ref = constraint.get("className", "")
        attribute_name = constraint.get("attributeName", "")
        check_type = constraint.get("checkType", "")
        check_value = constraint.get("checkValue", "")
        case_sensitive = constraint.get("caseSensitive", False)

        if not class_ref or not attribute_name or not check_type:
            return

        class_uri = get_uri(class_ref)
        class_local = str(class_uri).split("#")[-1].split("/")[-1]
        attr_safe = re.sub(r"[^a-zA-Z0-9_]", "_", attribute_name)

        constraint_uri = URIRef(self.base_uri + f"_valueConstraint_{class_local}_{attr_safe}_{check_type}")

        self.graph.add((constraint_uri, RDF.type, ONTOBRICKS_NS.ValueConstraint))
        self.graph.add((constraint_uri, ONTOBRICKS_NS.appliesTo, class_uri))
        self.graph.add((constraint_uri, ONTOBRICKS_NS.onAttribute, Literal(attribute_name)))
        self.graph.add((constraint_uri, ONTOBRICKS_NS.checkType, Literal(check_type)))

        if check_value:
            self.graph.add((constraint_uri, ONTOBRICKS_NS.checkValue, Literal(check_value)))

        self.graph.add((constraint_uri, ONTOBRICKS_NS.caseSensitive, Literal(case_sensitive, datatype=XSD.boolean)))
        self.graph.add((class_uri, ONTOBRICKS_NS.hasValueConstraint, constraint_uri))

    def _add_global_rule_constraint(self, constraint: Dict):
        rule_name = constraint.get("ruleName", "")
        if not rule_name:
            return

        rule_uri = URIRef(self.base_uri + f"_globalRule_{rule_name}")

        self.graph.add((rule_uri, RDF.type, ONTOBRICKS_NS.GlobalRule))
        self.graph.add((rule_uri, ONTOBRICKS_NS.ruleName, Literal(rule_name)))

        rule_descriptions = {
            "noOrphans": "Every entity must have at least one relationship",
            "requireLabels": "Every entity must have an rdfs:label",
            "uniqueIds": "All entity identifiers must be unique",
        }
        if rule_name in rule_descriptions:
            self.graph.add((rule_uri, RDFS.comment, Literal(rule_descriptions[rule_name])))

    # ------------------------------------------------------------------
    # Classes
    # ------------------------------------------------------------------

    def _add_class(self, cls: Dict):
        """Add a class to the ontology."""
        class_name = cls.get("name", "").strip()
        if not class_name:
            return

        class_uri = URIRef(self.base_uri + class_name)

        self.graph.add((class_uri, RDF.type, OWL.Class))

        label = cls.get("label", class_name)
        if label:
            self.graph.add((class_uri, RDFS.label, Literal(label)))

        comment = cls.get("comment", "") or cls.get("description", "")
        if comment:
            self.graph.add((class_uri, RDFS.comment, Literal(comment)))

        emoji = cls.get("emoji", "")
        if emoji:
            self.graph.add((class_uri, ONTOBRICKS_NS.icon, Literal(emoji)))

        dashboard = cls.get("dashboard", "")
        if dashboard:
            self.graph.add((class_uri, ONTOBRICKS_NS.dashboard, Literal(dashboard, datatype=XSD.anyURI)))

        dashboard_params = cls.get("dashboardParams", {})
        if dashboard_params:
            self.graph.add((class_uri, ONTOBRICKS_NS.dashboardParams, Literal(json.dumps(dashboard_params))))

        parent = cls.get("parent", "").strip() if cls.get("parent") else ""
        if parent:
            if parent.startswith("http://") or parent.startswith("https://"):
                parent_uri = URIRef(parent)
            else:
                parent_uri = URIRef(self.base_uri + parent)
            self.graph.add((class_uri, RDFS.subClassOf, parent_uri))

        data_props = cls.get("dataProperties", [])
        for data_prop in data_props:
            self._add_data_property_for_class(data_prop, class_name)

    def _sanitize_name(self, name: str) -> str:
        """Sanitize a name to be URI-safe."""
        if not name:
            return name
        sanitized = name.replace(" ", "_")
        sanitized = "".join(c if c.isalnum() or c == "_" else "_" for c in sanitized)
        while "__" in sanitized:
            sanitized = sanitized.replace("__", "_")
        sanitized = sanitized.strip("_")
        return sanitized

    def _add_data_property_for_class(self, data_prop: Dict, class_name: str):
        """Add a data property (attribute) for a specific class."""
        if isinstance(data_prop, str):
            prop_name = data_prop.strip()
        else:
            prop_name = (data_prop.get("name", "") or data_prop.get("localName", "")).strip()

        if not prop_name:
            return

        original_name = prop_name
        prop_name = self._sanitize_name(prop_name)
        if not prop_name:
            return

        prop_uri = URIRef(self.base_uri + prop_name)

        if (prop_uri, RDF.type, OWL.DatatypeProperty) in self.graph:
            return

        self.graph.add((prop_uri, RDF.type, OWL.DatatypeProperty))
        self.graph.add((prop_uri, RDFS.label, Literal(original_name)))

        domain_uri = URIRef(self.base_uri + class_name)
        self.graph.add((prop_uri, RDFS.domain, domain_uri))

        prop_type = data_prop.get("type", "string") if isinstance(data_prop, dict) else "string"
        range_uri = self._get_xsd_type(prop_type)
        self.graph.add((prop_uri, RDFS.range, range_uri))

    def _get_xsd_type(self, type_name: str) -> URIRef:
        """Convert a type name to XSD URI."""
        type_mapping = {
            "string": XSD.string,
            "text": XSD.string,
            "integer": XSD.integer,
            "int": XSD.integer,
            "number": XSD.decimal,
            "decimal": XSD.decimal,
            "float": XSD.float,
            "double": XSD.double,
            "boolean": XSD.boolean,
            "bool": XSD.boolean,
            "date": XSD.date,
            "datetime": XSD.dateTime,
            "time": XSD.time,
            "uri": XSD.anyURI,
            "url": XSD.anyURI,
        }
        return type_mapping.get(type_name.lower(), XSD.string)

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    def _add_property(self, prop: Dict):
        """Add a property to the ontology."""
        prop_name = prop.get("name", "").strip()
        if not prop_name:
            return

        prop_uri = URIRef(self.base_uri + prop_name)

        prop_type = prop.get("type", "ObjectProperty")
        if prop_type == "DatatypeProperty":
            self.graph.add((prop_uri, RDF.type, OWL.DatatypeProperty))
        else:
            self.graph.add((prop_uri, RDF.type, OWL.ObjectProperty))

        label = prop.get("label", prop_name)
        if label:
            self.graph.add((prop_uri, RDFS.label, Literal(label)))

        comment = prop.get("comment", "")
        if comment:
            self.graph.add((prop_uri, RDFS.comment, Literal(comment)))

        direction = prop.get("direction", "forward")
        if direction:
            self.graph.add((prop_uri, ONTOBRICKS_NS.direction, Literal(direction)))

        domain = prop.get("domain", "")
        if domain:
            domain = domain.strip()
            if domain.startswith("http://") or domain.startswith("https://"):
                domain_uri = URIRef(domain)
            else:
                domain_uri = URIRef(self.base_uri + domain)
            self.graph.add((prop_uri, RDFS.domain, domain_uri))

        range_val = prop.get("range", "")
        if range_val:
            range_val = range_val.strip()
            if range_val.startswith("http://") or range_val.startswith("https://"):
                range_uri = URIRef(range_val)
            elif range_val.startswith("xsd:"):
                datatype = range_val.replace("xsd:", "")
                range_uri = self._get_xsd_type(datatype)
            else:
                range_uri = URIRef(self.base_uri + range_val)
            self.graph.add((prop_uri, RDFS.range, range_uri))

    # ------------------------------------------------------------------
    # SWRL Rules
    # ------------------------------------------------------------------

    def _add_swrl_rule(self, rule: Dict):
        """Add a SWRL rule to the ontology as annotation."""
        name = rule.get("name", "").strip()
        if not name:
            return

        safe_name = self._sanitize_name(name)
        rule_uri = URIRef(self.base_uri + f"_swrlRule_{safe_name}")

        self.graph.add((rule_uri, RDF.type, ONTOBRICKS_NS.SWRLRule))
        self.graph.add((rule_uri, RDFS.label, Literal(name)))

        description = rule.get("description", "")
        if description:
            self.graph.add((rule_uri, RDFS.comment, Literal(description)))

        antecedent = rule.get("antecedent", "")
        if antecedent:
            self.graph.add((rule_uri, ONTOBRICKS_NS.antecedent, Literal(antecedent)))

        consequent = rule.get("consequent", "")
        if consequent:
            self.graph.add((rule_uri, ONTOBRICKS_NS.consequent, Literal(consequent)))

    # ------------------------------------------------------------------
    # Axioms
    # ------------------------------------------------------------------

    def _add_axiom(self, axiom: Dict):
        """Add an OWL axiom to the ontology."""
        axiom_type = axiom.get("type", "")
        subject = axiom.get("subject", "")
        objects = axiom.get("objects", [])

        if not axiom_type:
            return

        def get_uri(ref):
            if not ref:
                return None
            if ref.startswith("http://") or ref.startswith("https://"):
                return URIRef(ref)
            return URIRef(self.base_uri + ref)

        subject_uri = get_uri(subject) if subject else None

        if axiom_type == "equivalentClass" and subject_uri and objects:
            for obj in objects:
                obj_uri = get_uri(obj)
                if obj_uri:
                    self.graph.add((subject_uri, OWL.equivalentClass, obj_uri))

        elif axiom_type == "disjointWith" and subject_uri and objects:
            for obj in objects:
                obj_uri = get_uri(obj)
                if obj_uri:
                    self.graph.add((subject_uri, OWL.disjointWith, obj_uri))

        elif axiom_type == "inverseOf" and subject_uri and objects:
            for obj in objects:
                obj_uri = get_uri(obj)
                if obj_uri:
                    self.graph.add((subject_uri, OWL.inverseOf, obj_uri))

        elif axiom_type == "disjointProperties" and subject_uri and objects:
            for obj in objects:
                obj_uri = get_uri(obj)
                if obj_uri:
                    self.graph.add((subject_uri, OWL.propertyDisjointWith, obj_uri))

        elif axiom_type == "propertyChain":
            chain = axiom.get("chain", [])
            result_property = axiom.get("resultProperty", "")
            if len(chain) >= 2 and result_property:
                result_uri = get_uri(result_property)
                if result_uri:
                    chain_uris = [get_uri(p) for p in chain if p]
                    chain_uris = [u for u in chain_uris if u]
                    if len(chain_uris) >= 2:
                        chain_list = BNode()
                        Collection(self.graph, chain_list, chain_uris)
                        self.graph.add((result_uri, OWL.propertyChainAxiom, chain_list))

        elif axiom_type == "unionOf" and subject_uri and objects:
            obj_uris = [get_uri(o) for o in objects if o]
            obj_uris = [u for u in obj_uris if u]
            if obj_uris:
                union_list = BNode()
                Collection(self.graph, union_list, obj_uris)
                self.graph.add((subject_uri, OWL.unionOf, union_list))

        elif axiom_type == "intersectionOf" and subject_uri and objects:
            obj_uris = [get_uri(o) for o in objects if o]
            obj_uris = [u for u in obj_uris if u]
            if obj_uris:
                intersection_list = BNode()
                Collection(self.graph, intersection_list, obj_uris)
                self.graph.add((subject_uri, OWL.intersectionOf, intersection_list))

        elif axiom_type == "complementOf" and subject_uri and objects:
            if objects:
                obj_uri = get_uri(objects[0])
                if obj_uri:
                    self.graph.add((subject_uri, OWL.complementOf, obj_uri))

        elif axiom_type == "oneOf" and subject_uri:
            individuals = axiom.get("individuals", [])
            if individuals:
                ind_uris = [get_uri(i) for i in individuals if i]
                ind_uris = [u for u in ind_uris if u]
                if ind_uris:
                    one_of_list = BNode()
                    Collection(self.graph, one_of_list, ind_uris)
                    self.graph.add((subject_uri, OWL.oneOf, one_of_list))
